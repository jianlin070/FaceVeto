from fastapi import APIRouter, Depends, HTTPException
from google.cloud import firestore

from app.auth import User, require_user
from app.db import SERVER_TS, age_days, get_db
from app.models import Me, ProfileIn, Protection

router = APIRouter(prefix="/api", tags=["users"])


def iso(ts) -> str | None:
    return ts.isoformat() if ts else None


def load_me(user: User) -> Me:
    snap = get_db().collection("users").document(user.uid).get()
    if not snap.exists:
        return Me(uid=user.uid, email=user.email, is_admin=user.is_admin, profile_complete=False)
    d = snap.to_dict()
    p = d.get("protection") or {}
    return Me(
        uid=user.uid,
        email=d.get("email") or user.email,
        is_admin=user.is_admin,
        profile_complete=True,
        display_name=d.get("display_name", ""),
        handle=d.get("handle", ""),
        preferred_language=d.get("preferred_language", "en"),
        protection=Protection(
            status=p.get("status", "none"),
            enrolled_at=iso(p.get("enrolled_at")),
            template_version=p.get("template_version"),
        ),
        account_age_days=age_days(d.get("created_at")),
        is_demo=d.get("is_demo", False),
    )


@router.get("/me", response_model=Me)
def get_me(user: User = Depends(require_user)):
    return load_me(user)


@router.put("/me", response_model=Me)
def put_me(body: ProfileIn, user: User = Depends(require_user)):
    db = get_db()
    user_ref = db.collection("users").document(user.uid)
    handle_ref = db.collection("handles").document(body.handle)

    @firestore.transactional
    def save(tx: firestore.Transaction):
        owner = handle_ref.get(transaction=tx)
        if owner.exists and owner.get("uid") != user.uid:
            raise HTTPException(409, "That handle is taken, try another one")
        current = user_ref.get(transaction=tx)
        old_handle = current.get("handle") if current.exists else None
        if old_handle and old_handle != body.handle:
            tx.delete(db.collection("handles").document(old_handle))
        tx.set(handle_ref, {"uid": user.uid})
        data = body.model_dump() | {"email": user.email}
        if not current.exists:
            data |= {"created_at": SERVER_TS, "protection": {"status": "none"}, "is_demo": False}
        tx.set(user_ref, data, merge=True)

    save(db.transaction())
    return load_me(user)
