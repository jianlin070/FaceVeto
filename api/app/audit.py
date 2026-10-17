"""Append-only audit trail. Never pass embeddings, tokens or image bytes in details."""
from app.db import SERVER_TS, get_db


def audit(actor_uid: str, action: str, target: str, details: dict | None = None) -> None:
    get_db().collection("audit_logs").add(
        {"actor_uid": actor_uid, "action": action, "target": target, "details": details or {}, "at": SERVER_TS}
    )
