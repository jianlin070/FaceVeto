"""Owner alerts and the "Not me" / "It's me" decision."""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from google.cloud import firestore

from app.audit import audit
from app.auth import User, require_user
from app.cases.actions import OPEN, open_cases_for_post, publish_post, remove_post
from app.cases.evidence import generate_evidence
from app.db import SERVER_TS, get_db
from app.models import RespondIn

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["cases"])


def _iso(ts):
    return ts.isoformat() if ts else None


@router.get("/alerts")
def alerts(user: User = Depends(require_user)):
    db = get_db()
    cases = (db.collection("cases").where(filter=firestore.FieldFilter("owner_uid", "==", user.uid))
             .order_by("created_at", direction=firestore.Query.DESCENDING).limit(30).stream())
    notes = (db.collection("notifications").where(filter=firestore.FieldFilter("uid", "==", user.uid))
             .order_by("created_at", direction=firestore.Query.DESCENDING).limit(50).stream())
    notes = [{"id": n.id, **n.to_dict()} for n in notes]
    text_by_case = {n["case_id"]: n for n in notes if n.get("case_id")}

    out_cases = []
    for c in cases:
        d = c.to_dict()
        post = (db.collection("posts").document(d["post_id"]).get().to_dict()) or {}
        a = post.get("assessment") or {}
        note = text_by_case.get(c.id, {})
        out_cases.append({
            "case_id": c.id, "post_id": d["post_id"], "status": d["status"], "category": d["category"],
            "severity": d["severity"], "created_at": _iso(d.get("created_at")),
            "caption": post.get("caption", ""), "image_url": f"/api/media/{d['post_id']}",
            "title": note.get("title", ""), "body": note.get("body", ""),
            # A short, non-graphic explanation for the owner. No poster identity, no similarity score.
            "reason": a.get("reasoning", ""),
            "owner_response": (d.get("owner_response") or {}).get("value"),
            "admin_action": (d.get("admin_action") or {}).get("value"),
        })
    out_notes = [{
        "id": n["id"], "type": n["type"], "title": n["title"], "body": n["body"], "case_id": n.get("case_id"),
        "post_id": n.get("post_id"), "read": n.get("read", False), "created_at": _iso(n.get("created_at")),
    } for n in notes]
    return {"cases": out_cases, "notifications": out_notes}


@router.post("/notifications/read")
def mark_read(user: User = Depends(require_user)):
    db = get_db()
    q = (db.collection("notifications").where(filter=firestore.FieldFilter("uid", "==", user.uid))
         .where(filter=firestore.FieldFilter("read", "==", False)))
    batch = db.batch()
    n = 0
    for d in q.stream():
        batch.update(d.reference, {"read": True})
        n += 1
    if n:
        batch.commit()
    return {"marked": n}


@router.post("/cases/{case_id}/respond")
def respond(case_id: str, body: RespondIn, background: BackgroundTasks, user: User = Depends(require_user)):
    db = get_db()
    ref = db.collection("cases").document(case_id)
    snap = ref.get()
    if not snap.exists or snap.get("owner_uid") != user.uid:
        raise HTTPException(404, "Case not found")
    case = snap.to_dict()
    target = "owner_not_me" if body.response == "not_me" else "owner_its_me"
    if case["status"] == target:
        return {"case_id": case_id, "status": target}  # idempotent repeat
    if case["status"] != OPEN:
        raise HTTPException(409, "This case was already resolved")

    post_id = case["post_id"]
    ref.update({"status": target, "owner_response": {"value": body.response, "at": SERVER_TS}, "updated_at": SERVER_TS})
    if body.response == "not_me":
        remove_post(post_id)  # owner-initiated takedown, effective immediately
        background.add_task(generate_evidence, case_id)
    else:
        post_ref = db.collection("posts").document(post_id)
        post_ref.update({"approved_by": firestore.ArrayUnion([user.uid])})
        # Publish only if still held (another owner may have said "Not me") and nobody else is pending.
        if post_ref.get().get("status") == "held" and not open_cases_for_post(post_id, exclude_case=case_id):
            publish_post(post_id)
    audit(user.uid, f"owner_{body.response}", f"cases/{case_id}", {"post_id": post_id})
    log.info("owner responded", extra={"fields": {"case_id": case_id, "post_id": post_id, "response": body.response}})
    return {"case_id": case_id, "status": target}
