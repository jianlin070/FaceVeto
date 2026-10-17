"""Seed benign, faceless feed posts (generated scenery and food) so the demo feed is not empty."""
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import make_test_posts as mk  # noqa: E402

from app.db import get_bucket, get_db, now  # noqa: E402

POSTS = [
    ("seed-01", "demo-alice", "landscape", 0), ("seed-02", "demo-bob", "food", 0),
    ("seed-03", "demo-alice", "landscape", 2), ("seed-04", "demo-bob", "landscape", 3),
    ("seed-05", "demo-alice", "food", 1), ("seed-06", "demo-bob", "landscape", 4),
    ("seed-07", "demo-alice", "food", 2), ("seed-08", "demo-bob", "landscape", 5),
]


def seed_posts() -> None:
    db, bucket = get_db(), get_bucket()
    for i, (pid, uid, kind, seed) in enumerate(POSTS):
        user = db.collection("users").document(uid).get().to_dict()
        img, cap = (mk.landscape if kind == "landscape" else mk.food)(seed)
        path = f"posts/{pid}.jpg"
        bucket.blob(path).upload_from_string(mk.to_jpeg(img, 85), content_type="image/jpeg")
        db.collection("posts").document(pid).set({
            "author_uid": uid, "author_handle": user["handle"], "author_display_name": user["display_name"],
            "caption": cap, "image_path": path, "status": "published", "faces_detected": 0,
            "scan": {"latency_ms": None, "gemini_called": False}, "assessment": None,
            "decision": {"action": "publish", "reason": "seed data", "policy_version": "v1"},
            "approved_by": [], "is_seed": True, "created_at": now() - timedelta(hours=6 * (len(POSTS) - i)),
        })
    print(f"seeded {len(POSTS)} feed posts")


if __name__ == "__main__":
    seed_posts()
