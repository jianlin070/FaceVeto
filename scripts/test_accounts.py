"""Dedicated automated-test accounts (never demo users). Run locally with ADC.

Each call resets the password to a fresh random value and signs in through the Identity Toolkit REST API,
so no custom-token signing is needed on the developer machine.
"""
import secrets
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))

from firebase_admin import auth as fb_auth  # noqa: E402

from app.db import firebase_app, get_db, now  # noqa: E402
from demo_client import BASE, FIREBASE_API_KEY  # noqa: E402

TEST_USERS = {
    "owner": ("test-e2e-owner", "e2e-owner@test.faceveto.app", "E2E Owner", "e2e_owner"),
    "poster": ("test-e2e-poster", "e2e-poster@test.faceveto.app", "E2E Poster", "e2e_poster"),
}


def test_client(role: str, base: str = BASE) -> httpx.Client:
    uid, email, name, handle = TEST_USERS[role]
    app = firebase_app()
    password = secrets.token_urlsafe(24)
    try:
        fb_auth.update_user(uid, password=password, email=email, app=app)
    except fb_auth.UserNotFoundError:
        fb_auth.create_user(uid=uid, email=email, display_name=name, password=password, app=app)
    ref = get_db().collection("users").document(uid)
    if not ref.get().exists:
        ref.set({"display_name": name, "handle": handle, "email": email, "preferred_language": "en",
                 "is_demo": False, "is_test": True, "created_at": now(), "protection": {"status": "none"}})
        get_db().collection("handles").document(handle).set({"uid": uid})
    r = httpx.post(f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}",
                   json={"email": email, "password": password, "returnSecureToken": True}, timeout=30)
    r.raise_for_status()
    return httpx.Client(base_url=base, headers={"Authorization": f"Bearer {r.json()['idToken']}"}, timeout=120)
