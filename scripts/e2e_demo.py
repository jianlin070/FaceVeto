"""End-to-end check against a running FaceVeto API (default: the deployed URL).

    FACEVETO_URL=https://faceveto-2026.web.app api/.venv/bin/python scripts/e2e_demo.py

Uses dedicated test accounts and LFW faces. Cleans up after itself: templates deleted, test posts removed.
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import make_test_posts as mk  # noqa: E402
from demo_client import BASE, client  # noqa: E402
from lfw_faces import person_photos, video_like_frames  # noqa: E402
from test_accounts import test_client  # noqa: E402

PERSON_A, PERSON_B = 0, 1
results: list[tuple[str, bool, str]] = []
created_posts: list[str] = []


def check(name: str, ok: bool, detail: str = ""):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)


def enrol(c, photo):
    ch = c.get("/api/enrol/challenge").json()
    files = [("frames", (f"f{i}.jpg", mk.to_jpeg(f), "image/jpeg")) for i, f in enumerate(video_like_frames(photo))]
    liveness = {"challenges": ch["challenges"], "passed": True, "duration_ms": 6000, "nonce": ch["nonce"]}
    return c.post("/api/enrol", files=files, data={"liveness": json.dumps(liveness)})


def post(c, img, caption):
    t = time.perf_counter()
    r = c.post("/api/posts", files={"image": ("p.jpg", mk.to_jpeg(img), "image/jpeg")}, data={"caption": caption})
    ms = int((time.perf_counter() - t) * 1000)
    if r.status_code == 200:
        created_posts.append(r.json()["post_id"])
    return r, ms


def wait_case(c, post_id, timeout=10.0):
    t = time.perf_counter()
    while time.perf_counter() - t < timeout:
        for case in c.get("/api/alerts").json()["cases"]:
            if case["post_id"] == post_id:
                return case, time.perf_counter() - t
        time.sleep(0.5)
    return None, timeout


def main():
    print(f"target: {BASE}")
    owner, poster = test_client("owner"), test_client("poster")
    a_photos = person_photos(PERSON_A, 4)
    owner.delete("/api/enrol")
    poster.delete("/api/enrol")

    r = enrol(owner, a_photos[0])
    check("enrol owner (LFW person A)", r.status_code == 200, r.text[:120])
    r = enrol(poster, a_photos[1])
    check("same face on a second account is rejected with 409", r.status_code == 409, r.text[:120])
    me = owner.get("/api/me").json()
    check("owner protection active", me["protection"]["status"] == "active")

    img, cap = mk.landscape(1)
    r, ms = post(poster, img, cap)
    check("landscape publishes instantly", r.json().get("status") == "published", f"{ms} ms")

    img, cap = mk.gambling(a_photos[2], 0)
    r, ms = post(poster, img, cap)
    body = r.json()
    check("gambling post with owner's face is under review", body.get("status") == "under_review", f"{ms} ms")
    check("poster response reveals no match info", set(body) == {"post_id", "status"}, str(body))
    held_id = body.get("post_id")
    mine = {p["post_id"]: p for p in poster.get("/api/posts/mine").json()}
    check("poster sees 'under_review' in own posts", mine.get(held_id, {}).get("status") == "under_review")
    check("poster cannot view held image", poster.get(f"/api/media/{held_id}").status_code == 404)
    case, secs = wait_case(owner, held_id)
    check("owner sees the case within 3 s", case is not None and secs <= 3, f"{secs:.1f} s, category={case and case['category']}")
    check("owner can view held image", owner.get(f"/api/media/{held_id}").status_code == 200)
    feed_ids = {p["post_id"] for p in poster.get("/api/feed").json()}
    check("held post is not in the feed", held_id not in feed_ids)
    if case:
        r = owner.post(f"/api/cases/{case['case_id']}/respond", json={"response": "not_me"})
        check("Not me removes the post", r.status_code == 200 and r.json()["status"] == "owner_not_me")
        check("removed image hidden from owner", owner.get(f"/api/media/{held_id}").status_code == 404)
        r2 = owner.post(f"/api/cases/{case['case_id']}/respond", json={"response": "not_me"})
        check("respond is idempotent", r2.status_code == 200)

    img, cap = mk.scam(a_photos[3], 0)
    r, _ = post(poster, img, cap)
    held2 = r.json().get("post_id")
    check("scam post is under review", r.json().get("status") == "under_review")
    case, _ = wait_case(owner, held2)
    if case:
        r = owner.post(f"/api/cases/{case['case_id']}/respond", json={"response": "its_me"})
        feed_ids = {p["post_id"] for p in poster.get("/api/feed").json()}
        check("It's me publishes the post", r.status_code == 200 and held2 in feed_ids)

    img, cap = mk.benign(a_photos[2], 0)
    r, _ = post(poster, img, cap)
    check("benign post with owner's face publishes", r.json().get("status") == "published")
    time.sleep(1)
    notes = owner.get("/api/alerts").json()["notifications"]
    check("owner gets an FYI notification", any(n["type"] == "fyi_appearance" and n["post_id"] == r.json().get("post_id") for n in notes))

    img, cap = mk.plain(a_photos[1])
    r, _ = post(owner, img, cap)
    check("owner's own selfie publishes (ownership check)", r.json().get("status") == "published")

    img, cap = mk.injection(a_photos[3])
    r, _ = post(poster, img, cap)
    check("prompt injection caption with betting banner is still held", r.json().get("status") == "under_review")

    try:
        admin = client("admin")
        stats = admin.get("/api/admin/stats")
        check("admin stats reachable", stats.status_code == 200, stats.text[:160])
        check("non-admin blocked from admin API", poster.get("/api/admin/cases").status_code == 403)
    except Exception as e:  # demo login unavailable (DEMO_MODE off or local signer missing)
        check("admin checks", False, f"skipped: {type(e).__name__}")

    cleanup(owner, poster)
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


def cleanup(owner, poster):
    from app.db import get_db

    owner.delete("/api/enrol")
    poster.delete("/api/enrol")
    from google.cloud.firestore import FieldFilter

    db = get_db()
    for pid in created_posts:
        db.collection("posts").document(pid).update({"status": "removed", "is_test": True})
        # Test cases and alerts show LFW faces, so they must never reach the admin queue judges see.
        for col in ("cases", "notifications"):
            for d in db.collection(col).where(filter=FieldFilter("post_id", "==", pid)).stream():
                d.reference.delete()
    print(f"cleanup: templates deleted, {len(created_posts)} test posts removed, their cases and alerts deleted")


if __name__ == "__main__":
    main()
