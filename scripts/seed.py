"""Seed demo users (and, with --posts, benign feed posts). Run locally with ADC:

    api/.venv/bin/python scripts/seed.py [--posts]

Idempotent. Demo users sign in through /api/demo/login-token, so passwords are random and unused.
Alice's face is NOT seeded: the team member playing Alice enrols live on /enrol.
"""
import argparse
import secrets
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))

from firebase_admin import auth as fb_auth  # noqa: E402

from app.db import firebase_app, get_db, now  # noqa: E402

DEMO_USERS = [
    # uid, email, display name, handle, language, account age in days, admin
    ("demo-alice", "alice@demo.faceveto.app", "Alice Tan", "alice", "en", 400, False),
    ("demo-bob", "bob@demo.faceveto.app", "Bob K", "bob_k", "en", 3, False),
    ("demo-admin", "admin@demo.faceveto.app", "Trust & Safety", "ts_admin", "en", 900, True),
]


def seed_users() -> None:
    app = firebase_app()
    db = get_db()
    for uid, email, name, handle, lang, age, admin in DEMO_USERS:
        try:
            fb_auth.get_user(uid, app=app)
            print(f"auth user exists: {uid}")
        except fb_auth.UserNotFoundError:
            fb_auth.create_user(uid=uid, email=email, display_name=name,
                                password=secrets.token_urlsafe(18), app=app)
            print(f"created auth user: {uid}")
        fb_auth.set_custom_user_claims(uid, {"admin": True} if admin else None, app=app)

        ref = db.collection("users").document(uid)
        snap = ref.get()
        data = {"display_name": name, "handle": handle, "email": email,
                "preferred_language": lang, "is_demo": True, "created_at": now() - timedelta(days=age)}
        if not snap.exists:
            data["protection"] = {"status": "none"}
        ref.set(data, merge=True)
        db.collection("handles").document(handle).set({"uid": uid})
    print("users seeded")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--posts", action="store_true", help="also seed benign feed posts")
    args = parser.parse_args()
    seed_users()
    if args.posts:
        from seed_posts import seed_posts  # noqa: E402

        seed_posts()
