"""Trust & safety console: review queue, case detail, actions, evidence pack, stats."""
import html
import statistics

import markdown
from fastapi import APIRouter, Depends, HTTPException, Response
from google.cloud import firestore

from app.audit import audit
from app.auth import User, require_admin
from app.cases.actions import publish_post, remove_post
from app.cases.evidence import case_facts, generate_evidence
from app.db import SERVER_TS, age_days, get_db
from app.models import AdminActionIn
from app.scan.pipeline import notify

router = APIRouter(prefix="/api/admin", tags=["admin"])

STATUSES = {"awaiting_owner", "owner_not_me", "owner_its_me", "removed", "released"}


def _iso(ts):
    return ts.isoformat() if ts else None


def _handle(uid: str, cache: dict) -> str:
    if uid not in cache:
        cache[uid] = (get_db().collection("users").document(uid).get().to_dict() or {}).get("handle", uid)
    return cache[uid]


@router.get("/cases")
def queue(status: str | None = None, limit: int = 50, _: User = Depends(require_admin)):
    q = get_db().collection("cases")
    if status:
        if status not in STATUSES:
            raise HTTPException(422, "Unknown status")
        q = q.where(filter=firestore.FieldFilter("status", "==", status))
    q = q.order_by("created_at", direction=firestore.Query.DESCENDING).limit(min(limit, 100))
    handles: dict = {}
    out = []
    for c in q.stream():
        d = c.to_dict()
        out.append({
            "case_id": c.id, "post_id": d["post_id"], "status": d["status"], "category": d["category"],
            "severity": d["severity"], "confidence": d.get("confidence"), "similarity": d.get("similarity"),
            "created_at": _iso(d.get("created_at")), "owner_handle": _handle(d["owner_uid"], handles),
            "poster_handle": _handle(d["poster_uid"], handles),
            "owner_response": (d.get("owner_response") or {}).get("value"),
        })
    return out


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
    }


@router.post("/cases/{case_id}/action")
def action(case_id: str, body: AdminActionIn, admin: User = Depends(require_admin)):
    db = get_db()
    ref = db.collection("cases").document(case_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(404, "Case not found")
    c = snap.to_dict()
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


def _pct(values: list[float], p: float):
    if not values:
        return None
    v = sorted(values)
    return v[min(len(v) - 1, int(round(p * (len(v) - 1))))]


@router.get("/stats")
def stats(_: User = Depends(require_admin)):
    db = get_db()
    posts = [p.to_dict() for p in db.collection("posts")
             .order_by("created_at", direction=firestore.Query.DESCENDING).limit(500).stream()]
    posts = [p for p in posts if not p.get("is_test")]
    counts = {s: sum(1 for p in posts if p.get("status") == s) for s in ("published", "held", "removed")}
    released = sum(1 for p in posts if p.get("released_at"))
    scans = [p["scan"] for p in posts if (p.get("scan") or {}).get("latency_ms") is not None]
    lat = [s["latency_ms"] for s in scans]
    gem = [s["gemini_latency_ms"] for s in scans if s.get("gemini_latency_ms")]
    held_ever = sum(1 for p in posts if (p.get("decision") or {}).get("action") == "hold")
    return {
        "posts_scanned": len(scans), "published": counts["published"], "held": counts["held"],
        "removed": counts["removed"], "released": released, "held_total": held_ever,
        "gemini_calls": len(gem),
        "scan_latency_ms": {"p50": _pct(lat, 0.5), "p95": _pct(lat, 0.95),
                            "mean": round(statistics.mean(lat)) if lat else None},
        "gemini_latency_ms": {"p50": _pct(gem, 0.5), "p95": _pct(gem, 0.95)},
    }

