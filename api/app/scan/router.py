import time
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from google.cloud import firestore

from app.auth import User, require_user
from app.db import SERVER_TS, age_days, get_db
from app.imaging import clean_image
from app.models import PostOut
from app.scan.pipeline import apply_decision, scan

router = APIRouter(prefix="/api", tags=["posts"])

MAX_UPLOAD = 8_000_000
POSTER_STATUS = {"processing": "processing", "published": "published", "held": "under_review", "removed": "removed"}


def post_out(doc_id: str, d: dict) -> PostOut:
    """Poster and feed view. Deliberately has no match, case or assessment fields."""
    ts = d.get("created_at")
    return PostOut(post_id=doc_id, author_handle=d.get("author_handle", ""),
                   author_display_name=d.get("author_display_name", ""), caption=d.get("caption", ""),
                   status=POSTER_STATUS.get(d.get("status"), "processing"),
                   created_at=ts.isoformat() if ts else None, image_url=f"/api/media/{doc_id}")


@router.post("/posts")
def create_post(image: UploadFile = File(...), caption: str = Form(""), user: User = Depends(require_user)):
    started_ms = time.perf_counter() * 1000
    if len(caption) > 2000:
        raise HTTPException(422, "Caption is too long (max 2,000 characters)")
    db = get_db()
    author = db.collection("users").document(user.uid).get().to_dict()
    if not author:
        raise HTTPException(403, "Finish setting up your profile first")
    img = clean_image(image.file.read(MAX_UPLOAD + 1), max_bytes=MAX_UPLOAD)

    post_id = uuid.uuid4().hex[:20]
    ref = db.collection("posts").document(post_id)
    ref.set({
        "author_uid": user.uid, "author_handle": author.get("handle", ""),
        "author_display_name": author.get("display_name", ""), "caption": caption,
        "image_path": None, "status": "processing", "faces_detected": 0,
        "scan": {"started_at": SERVER_TS}, "assessment": None, "decision": None, "approved_by": [],
        "created_at": SERVER_TS,
    })
    try:
        out = scan(img, caption, user.uid, age_days(author.get("created_at")), approved_by=[])
        status = apply_decision(post_id, img, author | {"uid": user.uid}, out, started_ms)
    except Exception:
        # Never leave a post publishable by accident: an unscanned post stays out of the feed.
        ref.update({"status": "held", "decision": {"action": "hold", "reason": "scan error, fail closed", "policy_version": "v1"}})
        raise
    return {"post_id": post_id, "status": status}


@router.get("/feed", response_model=list[PostOut])
def feed(before: str | None = None, limit: int = 20, user: User = Depends(require_user)):
    q = (get_db().collection("posts").where(filter=firestore.FieldFilter("status", "==", "published"))
         .order_by("created_at", direction=firestore.Query.DESCENDING))
    if before:
        q = q.start_after({"created_at": datetime.fromisoformat(before)})
    return [post_out(d.id, d.to_dict()) for d in q.limit(min(max(limit, 1), 50)).stream()]


@router.get("/posts/mine", response_model=list[PostOut])
def my_posts(user: User = Depends(require_user)):
    q = (get_db().collection("posts").where(filter=firestore.FieldFilter("author_uid", "==", user.uid))
         .order_by("created_at", direction=firestore.Query.DESCENDING).limit(30))
    return [post_out(d.id, d.to_dict()) for d in q.stream()]
