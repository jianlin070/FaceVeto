"""Firebase ID token verification and role dependencies."""
import logging
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as fb_auth

from app.db import firebase_app

log = logging.getLogger(__name__)
_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class User:
    uid: str
    email: str
    is_admin: bool


def require_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required")
    try:
        claims = fb_auth.verify_id_token(creds.credentials, app=firebase_app())
    except Exception as e:  # invalid, expired or revoked; never log the token itself
        log.info("token rejected: %s", type(e).__name__)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired, please sign in again")
    return User(uid=claims["uid"], email=claims.get("email", ""), is_admin=claims.get("admin") is True)


def require_admin(user: User = Depends(require_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only")
    return user
