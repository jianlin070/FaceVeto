from fastapi import APIRouter, Depends, HTTPException, Response
from google.cloud import firestore

from app.auth import User, require_user
from app.db import get_bucket, get_db

router = APIRouter(prefix="/api/media", tags=["media"])

OPEN_CASE = "awaiting_owner"


def can_view(status: str, user: User, open_case_owners: set[str]) -> bool:
    """Permission matrix for post images.

    published: any signed-in user. processing / held: admins and owners of an open case.
    removed: admins only. The poster of a held post cannot see it either: they only see "Under review".
    """
    if user.is_admin:
        return True
    if status == "published":
        return True
    if status in ("processing", "held"):
        return user.uid in open_case_owners
    return False


@router.get("/{post_id}")
def media(post_id: str, user: User = Depends(require_user)):
    db = get_db()
    snap = db.collection("posts").document(post_id).get()
    if not snap.exists:
        raise HTTPException(404, "Not found")
    post = snap.to_dict()
    owners: set[str] = set()
    if post["status"] in ("processing", "held") and not user.is_admin:
        q = (db.collection("cases").where(filter=firestore.FieldFilter("post_id", "==", post_id))
             .where(filter=firestore.FieldFilter("status", "==", OPEN_CASE)))
        owners = {c.get("owner_uid") for c in q.stream()}
    if not can_view(post["status"], user, owners) or not post.get("image_path"):
        raise HTTPException(404, "Not found")  # same answer as missing, so nothing leaks
    data = get_bucket().blob(post["image_path"]).download_as_bytes()
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=60"})
