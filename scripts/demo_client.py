"""Tiny HTTP client that signs in as a demo user against a deployed FaceVeto URL.

Used by e2e_demo.py and the eval scripts. Requires DEMO_MODE on the server.
"""
import os

import httpx

BASE = os.environ.get("FACEVETO_URL", "https://faceveto-2026.web.app")
FIREBASE_API_KEY = "AIzaSyCxCx_ZclegsoFMj_UkvjHbB9OTPA5OdbA"  # public web config


def id_token(who: str, base: str = BASE) -> str:
    r = httpx.post(f"{base}/api/demo/login-token", json={"who": who}, timeout=30)
    r.raise_for_status()
    r2 = httpx.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={FIREBASE_API_KEY}",
        json={"token": r.json()["token"], "returnSecureToken": True},
        timeout=30,
    )
    r2.raise_for_status()
    return r2.json()["idToken"]


def client(who: str, base: str = BASE) -> httpx.Client:
    return httpx.Client(base_url=base, headers={"Authorization": f"Bearer {id_token(who, base)}"}, timeout=120)
