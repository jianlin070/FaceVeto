"""One-click demo login for judges. Only mounted when DEMO_MODE is on."""
from fastapi import APIRouter
from firebase_admin import auth as fb_auth

from app.db import firebase_app
from app.models import DemoLoginIn

router = APIRouter(prefix="/api/demo", tags=["demo"])

DEMO_UIDS = {"alice": "demo-alice", "bob": "demo-bob", "admin": "demo-admin"}


@router.post("/login-token")
def login_token(body: DemoLoginIn):
    token = fb_auth.create_custom_token(DEMO_UIDS[body.who], app=firebase_app())
    return {"token": token.decode() if isinstance(token, bytes) else token}
