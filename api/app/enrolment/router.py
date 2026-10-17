"""Face enrolment: liveness challenge nonce, template creation, hard delete.

Frames are processed in memory and discarded. Only the averaged embedding is stored.
"""
import json
import logging
import random
import secrets
from datetime import timedelta
from itertools import combinations

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from google.cloud import firestore
from google.cloud.firestore_v1.vector import Vector
from pydantic import BaseModel, ValidationError

from app.audit import audit
from app.auth import User, require_user
from app.config import get_settings
from app.db import SERVER_TS, get_db, now
from app.face import engine
from app.face.matching import top_matches
from app.imaging import clean_image

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/enrol", tags=["enrolment"])

CHALLENGES = ["blink", "turn_left", "turn_right"]
NONCE_TTL = timedelta(minutes=2)
MAX_FRAME_BYTES = 1_500_000
FACE_HINT = "Make sure only your face is in the frame, in good light."


class LivenessReport(BaseModel):
    challenges: list[str]
    passed: bool
    duration_ms: int
    nonce: str


class EnrolError(ValueError):
    """Frame set rejected; message is safe to show the user."""


def build_template(embeddings: list[np.ndarray], intra_min: float) -> tuple[np.ndarray, float]:
    """Average per-frame embeddings into one template after checking they are the same person.

    Returns (L2-normalised template, minimum pairwise similarity).
    """
    if len(embeddings) < 3:
        raise EnrolError("We need at least 3 clear frames of your face. Please try again.")
    sims = [float(a @ b) for a, b in combinations(embeddings, 2)]
    intra = min(sims)
    if intra < intra_min:
        raise EnrolError("The frames did not look like the same person. Please try again without switching photos.")
    mean = np.mean(np.stack(embeddings), axis=0)
    return mean / np.linalg.norm(mean), intra


@router.get("/challenge")
def challenge(user: User = Depends(require_user)):
    nonce = secrets.token_urlsafe(24)
    order = random.sample(CHALLENGES, k=len(CHALLENGES))
    get_db().collection("enrol_nonces").document(nonce).set(
        {"uid": user.uid, "challenges": order, "expires_at": now() + NONCE_TTL}
    )
    return {"nonce": nonce, "challenges": order, "expires_in_s": int(NONCE_TTL.total_seconds())}


def _consume_nonce(uid: str, report: LivenessReport) -> None:
    db = get_db()
    ref = db.collection("enrol_nonces").document(report.nonce)

    @firestore.transactional
    def take(tx):
        snap = ref.get(transaction=tx)
        if not snap.exists:
            return None
        tx.delete(ref)  # single use, even when the rest of the check fails
        return snap.to_dict()

    data = take(db.transaction())
    if not data or data["uid"] != uid or data["expires_at"] < now():
        raise HTTPException(400, "The live check expired. Please start again.")
    if data["challenges"] != report.challenges:
        raise HTTPException(400, "The live check steps did not match. Please start again.")


@router.post("")
def enrol(
    frames: list[UploadFile] = File(...),
    liveness: str = Form(...),
    user: User = Depends(require_user),
):
    s = get_settings()
    try:
        report = LivenessReport.model_validate(json.loads(liveness))
    except (ValueError, ValidationError):
        raise HTTPException(422, "Invalid live check report")
    if not report.passed:
        raise HTTPException(400, "The live check was not completed")
    if not 3 <= len(frames) <= 5:
        raise HTTPException(422, "Send 3 to 5 frames")
    _consume_nonce(user.uid, report)

    embeddings, det_scores = [], []
    for f in frames:
        img = clean_image(f.file.read(MAX_FRAME_BYTES + 1), max_bytes=MAX_FRAME_BYTES)
        faces = engine.detect_and_embed(img.bgr)
        if len(faces) != 1 or faces[0].det_score < 0.6 or faces[0].min_side < 80:
            raise HTTPException(422, FACE_HINT)
        embeddings.append(faces[0].embedding)
        det_scores.append(faces[0].det_score)
    try:
        template, intra = build_template(embeddings, s.enrol_intra_min)
    except EnrolError as e:
        raise HTTPException(422, str(e))

    # Someone may try to enrol a victim's face first. One face, one account.
    for m in top_matches(template, limit=2):
        if m.uid != user.uid and m.similarity >= s.dup_threshold:
            audit(user.uid, "enrol_rejected_duplicate", f"users/{user.uid}", {"similarity": m.similarity})
            raise HTTPException(409, "This face is already protected by another account.")

    db = get_db()
    db.collection("face_templates").document(user.uid).set({
        "uid": user.uid,
        "embedding": Vector(template.astype(float).tolist()),
        "model": engine.MODEL_NAME,
        "quality": {"frames_used": len(embeddings), "intra_similarity_min": round(intra, 4),
                    "det_score_avg": round(float(np.mean(det_scores)), 4)},
        "liveness": {"challenges": report.challenges, "passed": True, "client_duration_ms": report.duration_ms},
        "created_at": SERVER_TS,
    })
    db.collection("users").document(user.uid).set({"protection": {
        "status": "active", "enrolled_at": SERVER_TS, "template_version": engine.TEMPLATE_VERSION,
    }}, merge=True)
    audit(user.uid, "enrol", f"users/{user.uid}", {"frames_used": len(embeddings), "intra_similarity_min": round(intra, 4)})
    log.info("enrolled", extra={"fields": {"uid": user.uid, "frames": len(embeddings)}})
    return {"status": "active", "frames_used": len(embeddings)}


@router.delete("")
def delete_template(user: User = Depends(require_user)):
    db = get_db()
    db.collection("face_templates").document(user.uid).delete()
    db.collection("users").document(user.uid).set(
        {"protection": {"status": "none", "enrolled_at": None, "template_version": None}}, merge=True
    )
    audit(user.uid, "template_deleted", f"users/{user.uid}")
    return {"status": "none"}
