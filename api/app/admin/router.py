"""Trust & safety console: review queue, case detail, actions, evidence pack, overview stats."""
import html
from datetime import datetime, timedelta, timezone

import markdown
from fastapi import APIRouter, Depends, HTTPException, Response
from google.cloud import firestore

from app.admin.insights import overview
from app.audit import audit
from app.auth import User, require_admin
from app.cases.actions import publish_post, remove_post
from app.cases.evidence import case_facts, generate_evidence
from app.db import SERVER_TS, age_days, get_db, now
from app.models import AdminActionIn
from app.scan.pipeline import notify

router = APIRouter(prefix="/api/admin", tags=["admin"])

STATUSES = {"awaiting_owner", "owner_not_me", "owner_its_me", "removed", "released"}


def allowed_actions(post_status: str | None) -> list[str]:
    """What an admin can still do to a post.

    Take down a post that is held or live. Release only a held post: a post removed after the owner
    said "Not me" stays down (it is their veto), and a deleted post is gone.
    """
    return {"held": ["takedown", "release"], "published": ["takedown"]}.get(post_status or "", [])


def _iso(ts):
    return ts.isoformat() if ts else None


def _handle(uid: str, cache: dict) -> str:
    if uid not in cache:
        cache[uid] = (get_db().collection("users").document(uid).get().to_dict() or {}).get("handle", uid)
    return cache[uid]


def _docs(collection: str, ids) -> dict[str, dict]:
    """Fetch many documents in one round trip. Missing ones come back as {}."""
    db = get_db()
    refs = [db.collection(collection).document(i) for i in dict.fromkeys(ids)]
    return {s.id: s.to_dict() or {} for s in db.get_all(refs)} if refs else {}


@router.get("/cases")
def queue(status: str | None = None, limit: int = 100, _: User = Depends(require_admin)):
    q = get_db().collection("cases")
    if status:
        if status not in STATUSES:
            raise HTTPException(422, "Unknown status")
        q = q.where(filter=firestore.FieldFilter("status", "==", status))
    q = q.order_by("created_at", direction=firestore.Query.DESCENDING).limit(min(limit, 100))
    cases = [(c.id, c.to_dict()) for c in q.stream()]
    posts = _docs("posts", [d["post_id"] for _, d in cases])
    users = _docs("users", [u for _, d in cases for u in (d["owner_uid"], d["poster_uid"])])
    handle = lambda uid: users.get(uid, {}).get("handle", uid)  # noqa: E731
    return [{
        "case_id": cid, "post_id": d["post_id"], "status": d["status"], "category": d["category"],
        "severity": d["severity"], "confidence": d.get("confidence"), "similarity": d.get("similarity"),
        "created_at": _iso(d.get("created_at")), "owner_handle": handle(d["owner_uid"]),
        "poster_handle": handle(d["poster_uid"]),
        "owner_response": (d.get("owner_response") or {}).get("value"),
        "caption": posts.get(d["post_id"], {}).get("caption", ""),
        "post_status": posts.get(d["post_id"], {}).get("status"),
    } for cid, d in cases]


def poster_cases(poster_uid: str, exclude_post: str, limit: int = 10) -> dict:
    """The poster's other held posts, newest first, one row per post, for the reviewer's context."""
    db = get_db()
    # Equality only, so no composite index; a poster has few cases, sorted here.
    snaps = db.collection("cases").where(filter=firestore.FieldFilter("poster_uid", "==", poster_uid)).limit(200).stream()
    newest: dict[str, tuple[str, dict]] = {}
    for s in snaps:
        d = s.to_dict()
        if d["post_id"] == exclude_post:
            continue
        if d["post_id"] not in newest or d["created_at"] > newest[d["post_id"]][1]["created_at"]:
            newest[d["post_id"]] = (s.id, d)
    rows = sorted(newest.values(), key=lambda x: x[1]["created_at"], reverse=True)
    posts = _docs("posts", [d["post_id"] for _, d in rows[:limit]])
    return {"total": len(rows), "cases": [{
        "case_id": cid, "status": d["status"], "category": d["category"], "created_at": _iso(d.get("created_at")),
        "caption": posts.get(d["post_id"], {}).get("caption", ""), "post_status": posts.get(d["post_id"], {}).get("status"),
    } for cid, d in rows[:limit]]}


@router.get("/cases/{case_id}")
def case_detail(case_id: str, _: User = Depends(require_admin)):
    db = get_db()
    snap = db.collection("cases").document(case_id).get()
    if not snap.exists:
        raise HTTPException(404, "Case not found")
    c = snap.to_dict()
    post = db.collection("posts").document(c["post_id"]).get().to_dict() or {}
    poster = db.collection("users").document(c["poster_uid"]).get().to_dict() or {}
    owner = db.collection("users").document(c["owner_uid"]).get().to_dict() or {}
    logs = db.collection("audit_logs").where(
        filter=firestore.FieldFilter("target", "in", [f"cases/{case_id}", f"posts/{c['post_id']}"])).stream()
    timeline = sorted(({"action": l.get("action"), "actor": l.get("actor_uid"), "at": _iso(l.get("at")),
                        "details": l.get("details")} for l in logs), key=lambda e: e["at"] or "")
    scan = post.get("scan") or {}
    return {
        "case_id": case_id, "status": c["status"], "similarity": c.get("similarity"),
        "category": c["category"], "severity": c["severity"], "confidence": c.get("confidence"),
        "created_at": _iso(c.get("created_at")),
        "owner_response": c.get("owner_response") and {**c["owner_response"], "at": _iso(c["owner_response"].get("at"))},
        "admin_action": c.get("admin_action") and {**c["admin_action"], "at": _iso(c["admin_action"].get("at"))},
        "has_evidence": bool(c.get("evidence_report_md")),
        "allowed_actions": allowed_actions(post.get("status")),
        "admin_handle": _handle(c["admin_action"]["by"], {}) if c.get("admin_action") else None,
        "owner": {"handle": owner.get("handle"), "display_name": owner.get("display_name")},
        "post": {
            "post_id": c["post_id"], "status": post.get("status"), "caption": post.get("caption", ""),
            "image_url": f"/api/media/{c['post_id']}", "created_at": _iso(post.get("created_at")),
            "poster_handle": post.get("author_handle"), "poster_account_age_days": age_days(poster.get("created_at")),
            "faces_detected": post.get("faces_detected"), "decision": post.get("decision"),
            "assessment": post.get("assessment"),
            "scan": {k: scan.get(k) for k in ("latency_ms", "detect_ms", "match_ms", "gemini_called",
                                              "gemini_latency_ms", "gemini_error", "agent_ms", "agent_trace")},
        },
        "timeline": timeline,
        "poster_cases": poster_cases(c["poster_uid"], c["post_id"]),
    }


@router.post("/cases/{case_id}/action")
def action(case_id: str, body: AdminActionIn, admin: User = Depends(require_admin)):
    db = get_db()
    ref = db.collection("cases").document(case_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(404, "Case not found")
    c = snap.to_dict()
    post_status = (db.collection("posts").document(c["post_id"]).get().to_dict() or {}).get("status")
    if body.action not in allowed_actions(post_status):
        raise HTTPException(409, {"published": "This post is already live.", "removed": "This post was already taken down.",
                                  "deleted": "The poster already deleted this post."}.get(post_status or "", "This action is no longer available."))
    if body.action == "takedown":
        remove_post(c["post_id"])
        status = "removed"
    else:
        publish_post(c["post_id"])
        status = "released"
    ref.update({"status": status, "updated_at": SERVER_TS,
                "admin_action": {"value": body.action, "by": admin.uid, "at": SERVER_TS, "note": body.note}})
    audit(admin.uid, f"admin_{body.action}", f"cases/{case_id}", {"post_id": c["post_id"], "note": body.note})
    text = ("Our review team removed the post that showed you." if body.action == "takedown"
            else "Our review team reviewed the post that showed you and allowed it.")
    notify(c["owner_uid"], "case_update", "Update on a post of you", text, case_id=case_id, post_id=c["post_id"])
    return {"case_id": case_id, "status": status}


@router.get("/cases/{case_id}/evidence")
def evidence(case_id: str, format: str = "json", regenerate: bool = False, _: User = Depends(require_admin)):
    snap = get_db().collection("cases").document(case_id).get()
    if not snap.exists:
        raise HTTPException(404, "Case not found")
    md = snap.get("evidence_report_md")
    if regenerate or not md:
        md = generate_evidence(case_id)
    if format == "md":
        return Response(md, media_type="text/markdown; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="faceveto-evidence-{case_id}.md"'})
    if format == "html":
        # The report quotes untrusted captions: escape raw HTML and forbid scripts entirely.
        body = markdown.markdown(html.escape(md, quote=False), extensions=["tables"])
        page = f"""<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>FaceVeto evidence pack {case_id}</title>
<style>body{{font:15px/1.55 Arial,sans-serif;color:#202124;max-width:780px;margin:32px auto;padding:0 16px}}
h1{{font-size:22px}}h2{{font-size:17px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}}
table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #ccc;padding:6px;text-align:left;font-size:13px}}
.meta{{color:#5F6368;font-size:13px}}@media print{{body{{margin:0}}}}</style></head><body>
<h1>FaceVeto evidence pack</h1><p class="meta">Case {html.escape(case_id)}</p>{body}</body></html>"""
        return Response(page, media_type="text/html; charset=utf-8",
                        headers={"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"})
    return {"case": case_facts(case_id), "report_md": md}


@router.get("/waiting")
def waiting(_: User = Depends(require_admin)):
    """Held posts nobody has decided on yet: the console's badge and headline number."""
    held = [p.to_dict() for p in get_db().collection("posts")
            .where(filter=firestore.FieldFilter("status", "==", "held")).select(["created_at", "is_test"]).stream()]
    times = [p["created_at"] for p in held if not p.get("is_test") and p.get("created_at")]
    return {"count": len(times), "oldest_at": _iso(min(times)) if times else None}


MAX_RANGE = timedelta(days=92)


@router.get("/stats")
def stats(since: datetime, _: User = Depends(require_admin)):
    """Overview for [since, now] plus the same length before it for comparison.

    The browser sends `since` as the start of its first chart bucket in local time, so days line up
    with the admin's calendar rather than UTC.
    """
    end = now()
    since = since if since.tzinfo else since.replace(tzinfo=timezone.utc)
    if not end - MAX_RANGE <= since < end:
        raise HTTPException(422, "since must be within the last 92 days")
    prev_since = since - (end - since)
    db = get_db()
    after = firestore.FieldFilter("created_at", ">=", prev_since)
    posts = [{"id": p.id, **p.to_dict()} for p in db.collection("posts").where(filter=after).select(
        ["created_at", "decision", "assessment.category", "status", "scan", "has_image", "is_test"]).stream()]
    cases = [{"id": c.id, **c.to_dict()} for c in db.collection("cases").where(filter=after).select(
        ["post_id", "owner_uid", "poster_uid", "category", "severity", "status", "created_at",
         "owner_response", "admin_action"]).stream()]
    out = overview(posts, cases, since, prev_since)
    users = _docs("users", [p["uid"] for p in out["posters"]] + [t["uid"] for t in out["targets"]])
    for row in out["posters"]:
        u = users.get(row.pop("uid"), {})
        row.update(handle=u.get("handle", "unknown"), account_age_days=age_days(u.get("created_at")))
    for row in out["targets"]:
        row["handle"] = users.get(row.pop("uid"), {}).get("handle", "unknown")
    return out

