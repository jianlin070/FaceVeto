"""Deterministic decision rule. Gemini recommends; code decides."""
from dataclasses import dataclass
from typing import Literal

from app.models import HarmAssessment, HarmCategory

POLICY_VERSION = "v1"
Action = Literal["publish", "publish_and_notify", "hold"]

ALWAYS_HOLD = {HarmCategory.sexual_or_intimate, HarmCategory.scam_or_fraud}


@dataclass(frozen=True)
class Decision:
    action: Action
    reason: str
    policy_version: str = POLICY_VERSION


def decide(assessment: HarmAssessment | None) -> Decision:
    """Decision for a post that shows a protected person who is not the poster."""
    if assessment is None:
        return Decision("hold", "assessment unavailable, fail closed")
    if assessment.category in ALWAYS_HOLD and assessment.confidence >= 0.5:
        return Decision("hold", f"{assessment.category.value} with confidence {assessment.confidence:.2f}")
    if assessment.is_harmful and assessment.severity in ("medium", "high"):
        return Decision("hold", f"{assessment.category.value}, severity {assessment.severity}")
    if assessment.is_harmful and assessment.severity == "low":
        return Decision("publish_and_notify", f"{assessment.category.value}, low severity")
    return Decision("publish_and_notify", "matched face, content judged benign")


NO_MATCH = Decision("publish", "no protected face of another user")
