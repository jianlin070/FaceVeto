"""Firestore and Cloud Storage clients plus small shared helpers."""
from datetime import datetime, timezone
from functools import lru_cache

import firebase_admin
from google.cloud import firestore, storage

from app.config import get_settings

SERVER_TS = firestore.SERVER_TIMESTAMP


@lru_cache
def firebase_app() -> firebase_admin.App:
    s = get_settings()
    options = {"projectId": s.gcp_project}
    if s.signer_service_account:
        options["serviceAccountId"] = s.signer_service_account
    try:
        return firebase_admin.get_app()
    except ValueError:
        return firebase_admin.initialize_app(options=options)


@lru_cache
def get_db() -> firestore.Client:
    return firestore.Client(project=get_settings().gcp_project)


@lru_cache
def get_bucket() -> storage.Bucket:
    s = get_settings()
    return storage.Client(project=s.gcp_project).bucket(s.media_bucket)


def now() -> datetime:
    return datetime.now(timezone.utc)


def age_days(ts: datetime | None) -> int:
    if not ts:
        return 0
    return max(0, (now() - ts).days)
