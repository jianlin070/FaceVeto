import time
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from google.cloud import firestore

from app.agent.policy import NO_MATCH
from app.audit import audit
from app.auth import User, require_user
from app.db import SERVER_TS, age_days, get_bucket, get_db
from app.imaging import CleanImage, clean_image, from_stored
from app.models import PostEditIn, PostOut
from app.scan.pipeline import ScanOutcome, apply_decision, scan

router = APIRouter(prefix="/api", tags=["posts"])

MAX_UPLOAD = 8_000_000
MAX_CAPTION = 2000
POSTER_STATUS = {"processing": "processing", "published": "published", "held": "under_review", "removed": "removed"}


def post_out(doc_id: str, d: dict, viewer_uid: str) -> PostOut:
    """Poster and feed view. Deliberately has no match, case or assessment fields."""
    ts = d.get("created_at")
    return PostOut(post_id=doc_id, author_handle=d.get("author_handle", ""),
                   author_display_name=d.get("author_display_name", ""), caption=d.get("caption", ""),
                   status=POSTER_STATUS.get(d.get("status"), "processing"),
                   created_at=ts.isoformat() if ts else None,
                   image_url=f"/api/media/{doc_id}" if d.get("has_image", True) else None,
                   is_mine=d.get("author_uid") == viewer_uid, edited=bool(d.get("edited_at")))


def _author(user: User) -> dict:
    author = get_db().collection("users").document(user.uid).get().to_dict()
    if not author:
        raise HTTPException(403, "Finish setting up your profile first")
    return author | {"uid": user.uid}


def _scan_and_apply(ref, img: CleanImage | None, caption: str, author: dict, started_ms: float,
                    *, notify_fyi: bool = True) -> str:
    try:
        if img is None:  # text only: no face to protect, nothing to hold
            out = ScanOutcome(0, {}, {}, NO_MATCH)
        else:
            out = scan(img, caption, author["uid"], age_days(author.get("created_at")), approved_by=[])
        return apply_decision(ref.id, img, author, out, started_ms, notify_fyi=notify_fyi)
    except Exception:
        # Never leave a post publishable by accident: an unscanned post stays out of the feed.
        ref.update({"status": "held", "decision": {"action": "hold", "reason": "scan error, fail closed", "policy_version": "v1"}})
        raise


@router.post("/posts")
def create_post(image: UploadFile | None = File(None), caption: str = Form(""), user: User = Depends(require_user)):
    started_ms = time.perf_counter() * 1000
    caption = caption.strip()
    if len(caption) > MAX_CAPTION:
        raise HTTPException(422, "Caption is too long (max 2,000 characters)")
    if image is None and not caption:
        raise HTTPException(422, "Write something or add a photo")
    author = _author(user)
    img = clean_image(image.file.read(MAX_UPLOAD + 1), max_bytes=MAX_UPLOAD) if image is not None else None

    post_id = uuid.uuid4().hex[:20]
    ref = get_db().collection("posts").document(post_id)
    ref.set({
        "author_uid": user.uid, "author_handle": author.get("handle", ""),
        "author_display_name": author.get("display_name", ""), "caption": caption,
        "image_path": None, "has_image": img is not None, "status": "processing", "faces_detected": 0,
        "scan": {"started_at": SERVER_TS}, "assessment": None, "decision": None, "approved_by": [],
        "created_at": SERVER_TS,
    })
    return {"post_id": post_id, "status": _scan_and_apply(ref, img, caption, author, started_ms)}


def _own_post(post_id: str, user: User):
    ref = get_db().collection("posts").document(post_id)
    snap = ref.get()
    if not snap.exists or snap.get("author_uid") != user.uid or snap.get("status") == "deleted":
        raise HTTPException(404, "Post not found")
    return ref, snap.to_dict()


@router.patch("/posts/{post_id}")
def edit_post(post_id: str, body: PostEditIn, user: User = Depends(require_user)):
    """Edit the caption. The post is scanned again, because a new caption can make the same photo harmful."""
    started_ms = time.perf_counter() * 1000
    ref, post = _own_post(post_id, user)
    if post["status"] != "published":
        raise HTTPException(409, "Only live posts can be edited")
    caption = body.caption.strip()
    old_path = post.get("image_path")
    if not caption and not old_path:
        raise HTTPException(422, "Write something or delete the post")
    if caption == post.get("caption", ""):
        return {"post_id": post_id, "status": "published"}
    author = _author(user)
    img = from_stored(get_bucket().blob(old_path).download_as_bytes()) if old_path else None
    # Approvals covered the post as the owner saw it, so they do not carry over to new wording.
    ref.update({"caption": caption, "status": "processing", "approved_by": [], "edited_at": SERVER_TS})
    status = _scan_and_apply(ref, img, caption, author, started_ms, notify_fyi=False)
    if old_path and status == "under_review":
        get_bucket().blob(old_path).delete()  # the copy now lives in quarantine/
    audit(user.uid, "post_edited", f"posts/{post_id}", {"status": status})
    return {"post_id": post_id, "status": status}


@router.delete("/posts/{post_id}")
def delete_post(post_id: str, user: User = Depends(require_user)):
    ref, post = _own_post(post_id, user)
    if post["status"] in ("held", "processing"):
        raise HTTPException(409, "This post is under review. You can delete it once a decision is made.")
    update = {"status": "deleted", "deleted_at": SERVER_TS}
    path = post.get("image_path") or ""
    if path.startswith("posts/"):  # quarantined images of removed posts are kept as evidence until they expire
        get_bucket().blob(path).delete()
        update["image_path"] = None
    ref.update(update)
    audit(user.uid, "post_deleted", f"posts/{post_id}", {"previous_status": post["status"]})
    return {"post_id": post_id, "status": "deleted"}


@router.get("/feed", response_model=list[PostOut])
def feed(before: str | None = None, limit: int = 20, user: User = Depends(require_user)):
    q = (get_db().collection("posts").where(filter=firestore.FieldFilter("status", "==", "published"))
         .order_by("created_at", direction=firestore.Query.DESCENDING))
    if before:
        q = q.start_after({"created_at": datetime.fromisoformat(before)})
    return [post_out(d.id, d.to_dict(), user.uid) for d in q.limit(min(max(limit, 1), 50)).stream()]


@router.get("/posts/mine", response_model=list[PostOut])
def my_posts(user: User = Depends(require_user)):
    q = (get_db().collection("posts").where(filter=firestore.FieldFilter("author_uid", "==", user.uid))
         .order_by("created_at", direction=firestore.Query.DESCENDING).limit(40))
    posts = [(d.id, d.to_dict()) for d in q.stream()]
    return [post_out(i, d, user.uid) for i, d in posts if d.get("status") != "deleted"][:30]


def can_open_post(post: dict, user: User) -> bool:
    """Who can open a single post page.

    Live posts: anyone signed in. Your own post: you, unless deleted. Admins: anything.
    Held posts stay out for everyone else, including the protected person, who decides on them
    from the alert card without ever learning who posted.
    """
    if user.is_admin or post.get("status") == "published":
        return True
    return post.get("author_uid") == user.uid and post.get("status") != "deleted"


@router.get("/posts/{post_id}", response_model=PostOut)
def get_post(post_id: str, user: User = Depends(require_user)):
    snap = get_db().collection("posts").document(post_id).get()
    if not snap.exists or not can_open_post(snap.to_dict(), user):
        raise HTTPException(404, "This post is no longer available")  # same answer as missing, so nothing leaks
    return post_out(snap.id, snap.to_dict(), user.uid)
