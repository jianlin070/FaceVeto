"""Post state changes shared by owner responses and admin actions."""
from google.cloud import firestore

from app.db import SERVER_TS, get_bucket, get_db

OPEN = "awaiting_owner"


def open_cases_for_post(post_id: str, exclude_case: str | None = None) -> list[str]:
    q = (get_db().collection("cases").where(filter=firestore.FieldFilter("post_id", "==", post_id))
         .where(filter=firestore.FieldFilter("status", "==", OPEN)))
    return [c.id for c in q.stream() if c.id != exclude_case]


def publish_post(post_id: str) -> None:
    """Release a held post: move the image out of quarantine and make it visible."""
    db = get_db()
    ref = db.collection("posts").document(post_id)
    post = ref.get().to_dict()
    path = post.get("image_path") or ""
    if path.startswith("quarantine/"):
        bucket = get_bucket()
        new_path = f"posts/{post_id}.jpg"
        bucket.copy_blob(bucket.blob(path), bucket, new_path)
        bucket.blob(path).delete()
        path = new_path
    ref.update({"status": "published", "image_path": path, "released_at": SERVER_TS})


def remove_post(post_id: str) -> None:
    """Take a post down. The image stays where it is (quarantine for held posts) as evidence."""
    get_db().collection("posts").document(post_id).update({"status": "removed", "removed_at": SERVER_TS})
