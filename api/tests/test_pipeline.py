"""Pipeline decisions with a fake face engine, fake matcher and fake Gemini."""
import numpy as np

from app.agent.gemini import AssessResult
from app.face.engine import DetectedFace
from app.face.matching import Match, best_match_per_uid
from app.imaging import CleanImage
from app.models import HarmAssessment, HarmCategory
from app.scan.pipeline import scan

IMG = CleanImage(jpeg=b"jpeg", bgr=np.zeros((10, 10, 3), np.uint8), width=10, height=10)
GAMBLING = HarmAssessment(is_harmful=True, category=HarmCategory.gambling_promotion, severity="high", confidence=0.95,
                          text_in_image="DAFTAR SEKARANG", languages=["ms"], evidence=["banner"], reasoning="betting ad",
                          recommended_action="hold")
BENIGN = GAMBLING.model_copy(update={"is_harmful": False, "category": HarmCategory.benign, "severity": "none"})


def face(i):
    e = np.zeros(512, np.float32)
    e[i] = 1
    return DetectedFace((0, 0, 100, 100), 0.9, e)


def fake_world(faces, who_by_index: dict[int, tuple[str, float]], assessment=GAMBLING):
    calls = []

    def detect(_):
        return faces

    def match(emb, limit):
        i = int(np.argmax(emb))
        return [Match(*who_by_index[i])] if i in who_by_index else []

    def assess(jpeg, caption, context):
        calls.append(context)
        return AssessResult(assessment, 120) if assessment else AssessResult(None, 20000, "gemini_error: Timeout")

    return dict(detect=detect, match=match, assess=assess), calls


def run(faces, who, author="bob", approved=(), assessment=GAMBLING):
    fakes, calls = fake_world(faces, who, assessment)
    return scan(IMG, "caption", author, 3, list(approved), threshold=0.45, **fakes), calls


def test_no_faces_publishes_without_gemini():
    out, calls = run([], {})
    assert out.decision.action == "publish" and not out.gemini_called and calls == []


def test_unregistered_face_publishes_without_gemini():
    out, calls = run([face(0)], {0: ("alice", 0.30)})  # below threshold
    assert out.decision.action == "publish" and calls == []


def test_own_face_publishes_without_gemini():
    out, calls = run([face(0)], {0: ("alice", 0.8)}, author="alice")
    assert out.decision.action == "publish" and calls == [] and out.matched == {"alice": 0.8}


def test_approved_owner_is_not_rechecked():
    out, calls = run([face(0)], {0: ("alice", 0.8)}, approved=["alice"])
    assert out.decision.action == "publish" and calls == []


def test_someone_elses_face_in_harmful_post_is_held():
    out, calls = run([face(0)], {0: ("alice", 0.8)})
    assert out.decision.action == "hold" and out.owner_matches == {"alice": 0.8}
    ctx = calls[0]
    assert ctx["matched_face_is_not_poster"] is True and ctx["poster_account_age_days"] == 3
    assert "alice" not in str(ctx)  # Gemini never receives the matched person's identity


def test_benign_match_publishes_with_fyi():
    out, _ = run([face(0)], {0: ("alice", 0.8)}, assessment=BENIGN)
    assert out.decision.action == "publish_and_notify"


def test_gemini_failure_fails_closed():
    out, _ = run([face(0)], {0: ("alice", 0.8)}, assessment=None)
    assert out.decision.action == "hold" and out.gemini_error


def test_group_photo_with_poster_and_victim():
    out, _ = run([face(0), face(1)], {0: ("bob", 0.9), 1: ("alice", 0.7)})
    assert out.owner_matches == {"alice": 0.7} and out.decision.action == "hold"


def test_best_match_per_uid_keeps_max_and_applies_threshold():
    best = best_match_per_uid([[Match("a", 0.5)], [Match("a", 0.7)], [Match("b", 0.4)]], 0.45)
    assert best == {"a": 0.7}
