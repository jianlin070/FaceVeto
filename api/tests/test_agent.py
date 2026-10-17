"""ADK agent guard rails, without calling a model."""
import numpy as np

from app.agent import adk_agent
from app.agent.gemini import AssessResult
from app.models import HarmAssessment, HarmCategory

GAMBLING = HarmAssessment(is_harmful=True, category=HarmCategory.gambling_promotion, severity="high", confidence=0.9,
                          text_in_image="", languages=[], evidence=[], reasoning="", recommended_action="hold")
BENIGN = HarmAssessment(is_harmful=False, category=HarmCategory.benign, severity="none", confidence=0.9,
                        text_in_image="", languages=[], evidence=[], reasoning="", recommended_action="allow_and_notify")


def tools_for(assessment):
    run = adk_agent.AgentRun()
    t = {f.__name__: f for f in adk_agent._tools(run, b"", "", {}, lambda *a: AssessResult(assessment, 1))}
    return run, t


def test_publish_refused_when_policy_holds():
    run, t = tools_for(GAMBLING)
    assert t["assess_content"]()["policy_action"] == "hold"
    assert t["publish_post"]("looks fine")["ok"] is False
    assert run.decision is None
    t["hold_post"]("gambling")
    assert run.decision.action == "hold"


def test_publish_requires_assessment_first():
    run, t = tools_for(BENIGN)
    assert t["publish_post"]("x")["ok"] is False
    t["assess_content"]()
    assert t["publish_post"]("benign")["ok"] is True and run.decision.action == "publish_and_notify"


def test_agent_failure_falls_back_to_policy(monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("model unavailable")

    monkeypatch.setattr(adk_agent, "_run", boom)
    run = adk_agent.moderate(b"", "", {}, assess=lambda *a: AssessResult(GAMBLING, 1))
    assert run.decision.action == "hold" and run.trace[-1]["step"] == "fallback"


def test_agent_cannot_loosen_policy(monkeypatch):
    async def lenient(run, *a, **k):
        run.assess = AssessResult(GAMBLING, 1)
        run.decision = adk_agent.Decision("publish_and_notify", "agent: bypass")

    monkeypatch.setattr(adk_agent, "_run", lenient)
    run = adk_agent.moderate(b"", "", {}, assess=lambda *a: AssessResult(GAMBLING, 1))
    assert run.decision.action == "hold"


def test_pipeline_uses_agent_when_enabled(monkeypatch):
    from app.face.engine import DetectedFace
    from app.face.matching import Match
    from app.imaging import CleanImage
    from app.scan.pipeline import scan

    monkeypatch.setattr(adk_agent, "moderate", lambda *a, **k: adk_agent.AgentRun(
        AssessResult(GAMBLING, 5), adk_agent.Decision("hold", "agent: x"), [{"step": "call", "tool": "hold_post"}], 9))
    e = np.zeros(512, np.float32)
    out = scan(CleanImage(b"", np.zeros((2, 2, 3), np.uint8), 2, 2), "", "bob", 3, [],
               detect=lambda _: [DetectedFace((0, 0, 99, 99), 0.9, e)], match=lambda *_: [Match("alice", 0.8)],
               threshold=0.45, use_agent=True)
    assert out.decision.action == "hold" and out.agent_trace and out.timings["agent_ms"] == 9
