import pytest

from app.agent.policy import decide
from app.models import HarmAssessment, HarmCategory


def a(category, harmful, severity, confidence=0.9):
    return HarmAssessment(is_harmful=harmful, category=category, severity=severity, confidence=confidence,
                          text_in_image="", languages=[], evidence=[], reasoning="", recommended_action="hold")


def test_error_fails_closed():
    assert decide(None).action == "hold"


@pytest.mark.parametrize("cat", [HarmCategory.sexual_or_intimate, HarmCategory.scam_or_fraud])
def test_always_hold_categories_even_if_model_says_low(cat):
    assert decide(a(cat, True, "low", 0.5)).action == "hold"
    assert decide(a(cat, False, "none", 0.6)).action == "hold"


def test_always_hold_category_with_low_confidence_falls_through():
    assert decide(a(HarmCategory.scam_or_fraud, True, "low", 0.4)).action == "publish_and_notify"


@pytest.mark.parametrize("sev", ["medium", "high"])
def test_harmful_medium_or_high_holds(sev):
    assert decide(a(HarmCategory.gambling_promotion, True, sev)).action == "hold"


def test_harmful_low_publishes_with_notice():
    assert decide(a(HarmCategory.harassment_or_defamation, True, "low")).action == "publish_and_notify"


def test_benign_publishes_with_fyi():
    d = decide(a(HarmCategory.benign, False, "none"))
    assert d.action == "publish_and_notify" and d.policy_version == "v1"
