"""The decision pipeline for a new post.

scan() is pure (collaborators are passed in) so the publish / notify / hold logic is unit tested.
apply_decision() persists the outcome: storage path, post status, cases, notifications, audit.
"""
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field

import numpy as np

from app.agent import gemini
from app.agent.policy import NO_MATCH, Decision, decide
from app.audit import audit
from app.config import get_settings
from app.db import SERVER_TS, get_bucket, get_db
from app.face import engine, matching
from app.face.matching import Match
from app.imaging import CleanImage
from app.models import HarmAssessment

log = logging.getLogger(__name__)

Detect = Callable[[np.ndarray], list[engine.DetectedFace]]
MatchFn = Callable[[np.ndarray, int], list[Match]]
Assess = Callable[[bytes, str, dict], gemini.AssessResult]


@dataclass
class ScanOutcome:
    faces_detected: int
    matched: dict[str, float]  # every protected person found, uid -> similarity (backend only)
    owner_matches: dict[str, float]  # protected people other than the poster who have not approved
    decision: Decision
    assessment: HarmAssessment | None = None
    gemini_called: bool = False
    gemini_latency_ms: int | None = None
    gemini_error: str | None = None
    gemini_tokens: int | None = None
    timings: dict = field(default_factory=dict)


def scan(img: CleanImage, caption: str, author_uid: str, author_age_days: int, approved_by: list[str],
         *, detect: Detect = engine.detect_and_embed, match: MatchFn = matching.top_matches,
         assess: Assess = gemini.assess_harm, threshold: float | None = None) -> ScanOutcome:
    threshold = get_settings().match_threshold if threshold is None else threshold
    t0 = time.perf_counter()
    faces = detect(img.bgr)
    t_detect = time.perf_counter()
    # Each face maps to at most one person: its nearest template.
    matched = matching.best_match_per_uid([match(f.embedding, 1) for f in faces], threshold)
    t_match = time.perf_counter()
    owners = {uid: sim for uid, sim in matched.items() if uid != author_uid and uid not in approved_by}
    timings = {"detect_ms": int((t_detect - t0) * 1000), "match_ms": int((t_match - t_detect) * 1000)}

    if not owners:  # cost gating: Gemini only runs when someone else's protected face appears
        return ScanOutcome(len(faces), matched, owners, NO_MATCH, timings=timings)

    context = {
        "poster_account_age_days": author_age_days,
        "faces_in_image": len(faces),
        "matched_face_is_not_poster": True,
        "platform": "general social network, JAPAC",
    }
    res = assess(img.jpeg, caption, context)
    return ScanOutcome(len(faces), matched, owners, decide(res.assessment), res.assessment, True,
                       res.latency_ms, res.error, res.tokens, timings)


def apply_decision(post_id: str, img: CleanImage, author: dict, out: ScanOutcome, started_ms: float) -> str:
    """Persist the outcome. Returns the poster-facing status: published | under_review."""
    db = get_db()
    held = out.decision.action == "hold"
    path = f"{'quarantine' if held else 'posts'}/{post_id}.jpg"
    get_bucket().blob(path).upload_from_string(img.jpeg, content_type="image/jpeg")
    latency_ms = int(time.perf_counter() * 1000 - started_ms)

    db.collection("posts").document(post_id).update({
        "image_path": path,
        "status": "held" if held else "published",
        "faces_detected": out.faces_detected,
        "scan": {
            "finished_at": SERVER_TS, "latency_ms": latency_ms,
            "matched": [{"uid": u, "similarity": s} for u, s in out.matched.items()],
            "gemini_called": out.gemini_called, "gemini_latency_ms": out.gemini_latency_ms,
            "gemini_error": out.gemini_error, "gemini_tokens": out.gemini_tokens, **out.timings,
        },
        "assessment": out.assessment.model_dump(mode="json") if out.assessment else None,
        "decision": {"action": out.decision.action, "reason": out.decision.reason,
                     "policy_version": out.decision.policy_version},
    })

    for owner_uid, similarity in out.owner_matches.items():
        owner = (db.collection("users").document(owner_uid).get().to_dict()) or {}
        lang = owner.get("preferred_language", "en")
        if held:
            case_ref = db.collection("cases").document()
            a = out.assessment
            case_ref.set({
                "post_id": post_id, "owner_uid": owner_uid, "poster_uid": author["uid"],
                "similarity": similarity,
                "category": a.category.value if a else "unassessed",
                "severity": a.severity if a else "high",
                "confidence": a.confidence if a else 0.0,
                "status": "awaiting_owner", "owner_response": None, "admin_action": None,
                "evidence_report_md": None, "created_at": SERVER_TS, "updated_at": SERVER_TS,
            })
            alert, by_ai = gemini.write_owner_alert("held_post", lang, a)
            notify(owner_uid, "held_post", alert.title, alert.body, case_id=case_ref.id, post_id=post_id, ai=by_ai)
            audit("system", "post_held", f"posts/{post_id}", {"case_id": case_ref.id, "reason": out.decision.reason})
        elif out.decision.action == "publish_and_notify":
            alert, by_ai = gemini.write_owner_alert("fyi_appearance", lang, out.assessment)
            notify(owner_uid, "fyi_appearance", alert.title, alert.body, post_id=post_id, ai=by_ai)

    log.info("post scanned", extra={"fields": {
        "post_id": post_id, "decision": out.decision.action, "latency_ms": latency_ms,
        "faces": out.faces_detected, "gemini_called": out.gemini_called, "gemini_latency_ms": out.gemini_latency_ms,
    }})
    return "under_review" if held else "published"


def notify(uid: str, kind: str, title: str, body: str, *, case_id: str | None = None,
           post_id: str | None = None, ai: bool = False) -> None:
    get_db().collection("notifications").add({
        "uid": uid, "type": kind, "title": title, "body": body, "case_id": case_id, "post_id": post_id,
        "ai_written": ai, "read": False, "created_at": SERVER_TS,
    })
