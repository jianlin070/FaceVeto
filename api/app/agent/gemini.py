"""Vertex AI Gemini calls: harm assessment, owner alert text, evidence pack."""
import json
import logging
import threading
import time
from dataclasses import dataclass

from google import genai
from google.genai import types

from app.agent import prompts
from app.config import get_settings
from app.models import HarmAssessment, HarmCategory, OwnerAlert

log = logging.getLogger(__name__)

# Relaxed because this is a moderation classifier that must SEE harmful input to label it.
SAFETY_OFF = [
    types.SafetySetting(category=c, threshold=types.HarmBlockThreshold.OFF)
    for c in (
        types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        types.HarmCategory.HARM_CATEGORY_HARASSMENT,
        types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    )
]
RETRY = types.HttpRetryOptions(attempts=2, initial_delay=0.5, max_delay=2.0, jitter=0.5,
                               http_status_codes=[429, 500, 502, 503, 504])


_client: genai.Client | None = None
_client_lock = threading.Lock()


def client() -> genai.Client:
    # A lock, not lru_cache: concurrent first calls would build extra Clients that get garbage
    # collected mid-request, closing their HTTP session ("client has been closed").
    global _client
    with _client_lock:
        if _client is None:
            s = get_settings()
            _client = genai.Client(vertexai=True, project=s.gcp_project, location=s.gemini_location,
                                   http_options=types.HttpOptions(timeout=s.gemini_timeout_ms, retry_options=RETRY))
        return _client


def _config(system: str, schema, temperature: float, **extra) -> types.GenerateContentConfig:
    s = get_settings()
    thinking = types.ThinkingConfig(thinking_level=s.gemini_thinking) if s.gemini_thinking else None
    return types.GenerateContentConfig(system_instruction=system, response_mime_type="application/json",
                                       response_schema=schema, temperature=temperature,
                                       safety_settings=SAFETY_OFF, thinking_config=thinking, **extra)


def _blocked(resp) -> bool:
    if resp.prompt_feedback and resp.prompt_feedback.block_reason:
        return True
    cand = resp.candidates[0] if resp.candidates else None
    return cand is None or cand.finish_reason in (types.FinishReason.SAFETY, types.FinishReason.PROHIBITED_CONTENT,
                                                  types.FinishReason.BLOCKLIST, types.FinishReason.SPII)


@dataclass
class AssessResult:
    assessment: HarmAssessment | None  # None means the call failed: the policy fails closed
    latency_ms: int
    error: str | None = None
    tokens: int | None = None


SAFETY_BLOCK_ASSESSMENT = HarmAssessment(
    is_harmful=True, category=HarmCategory.other_harmful, severity="high", confidence=0.5,
    text_in_image="", languages=[], evidence=["Model safety filter blocked the input"],
    reasoning="Model safety block on input, held for human review.", recommended_action="hold",
)


def assess_harm(jpeg: bytes, caption: str, context: dict) -> AssessResult:
    s = get_settings()
    user_prompt = prompts.HARM_USER_TEMPLATE.format(context_json=json.dumps(context), caption=caption)
    t0 = time.perf_counter()
    try:
        resp = client().models.generate_content(
            model=s.gemini_model,
            contents=[types.Part.from_bytes(data=jpeg, mime_type="image/jpeg"), user_prompt],
            config=_config(prompts.HARM_SYSTEM_PROMPT, HarmAssessment, 0.1),
        )
    except Exception as e:
        ms = int((time.perf_counter() - t0) * 1000)
        log.warning("gemini assess failed: %s: %s", type(e).__name__, str(e)[:300], extra={"fields": {"latency_ms": ms}})
        return AssessResult(None, ms, f"gemini_error: {type(e).__name__}")
    ms = int((time.perf_counter() - t0) * 1000)
    tokens = resp.usage_metadata.total_token_count if resp.usage_metadata else None
    if _blocked(resp):
        return AssessResult(SAFETY_BLOCK_ASSESSMENT, ms, "safety_block", tokens)
    parsed = resp.parsed
    if not isinstance(parsed, HarmAssessment):
        try:
            parsed = HarmAssessment.model_validate_json(resp.text or "")
        except Exception:
            log.warning("gemini returned unparseable assessment", extra={"fields": {"latency_ms": ms}})
            return AssessResult(None, ms, "gemini_error: unparseable", tokens)
    parsed.evidence = parsed.evidence[:5]
    return AssessResult(parsed, ms, None, tokens)


# ---------- owner alert text (localised) ----------
BUTTONS = {"not_me": "Not me", "its_me": "It's me"}

FALLBACK_ALERTS = {
    "held_post": {
        "en": ("A post of you is on hold", "Someone else posted a photo that looks like you, and it may be harmful. Nobody can see it yet. Tap \"Not me\" to remove it, or \"It's me\" to allow it."),
        "ms": ("Siaran anda sedang ditahan", "Seseorang memuat naik foto yang kelihatan seperti anda dan ia mungkin berbahaya. Belum ada yang dapat melihatnya. Tekan \"Not me\" untuk membuangnya, atau \"It's me\" untuk membenarkannya."),
        "zh": ("有一则含有你照片的贴文已被暂扣", "有人发布了一张看起来像你的照片，内容可能有害。目前没有人能看到它。点击 \"Not me\" 删除，或点击 \"It's me\" 允许发布。"),
    },
    "fyi_appearance": {
        "en": ("You appear in a new post", "Someone posted a photo that looks like you. It looked harmless so it is live. You can still review it in Alerts."),
        "ms": ("Anda muncul dalam siaran baharu", "Seseorang memuat naik foto yang kelihatan seperti anda. Ia kelihatan tidak berbahaya jadi ia telah disiarkan. Anda masih boleh menyemaknya di Alerts."),
        "zh": ("你出现在一则新贴文中", "有人发布了一张看起来像你的照片。内容看起来无害，所以已经发布。你仍然可以在提醒中查看。"),
    },
}


def fallback_alert(kind: str, language: str) -> OwnerAlert:
    title, body = FALLBACK_ALERTS[kind].get(language, FALLBACK_ALERTS[kind]["en"])
    return OwnerAlert(title=title, body=body)


def write_owner_alert(kind: str, language: str, assessment: HarmAssessment | None) -> tuple[OwnerAlert, bool]:
    """Localised alert text. Returns (alert, generated_by_gemini). Falls back to static templates."""
    if assessment is None:
        return fallback_alert(kind, language), False
    payload = {
        "type": "held post, waiting for the user's decision" if kind == "held_post" else "FYI, post was allowed",
        "language": {"en": "English", "ms": "Bahasa Melayu", "zh": "Simplified Chinese"}.get(language, "English"),
        "category": assessment.category.value,
        "severity": assessment.severity,
        "short_evidence": [e[:120] for e in assessment.evidence[:2]] if kind == "held_post" else [],
        "button_names": BUTTONS,
    }
    try:
        resp = client().models.generate_content(
            model=get_settings().gemini_model,
            contents=prompts.ALERT_USER_TEMPLATE.format(alert_json=json.dumps(payload, ensure_ascii=False)),
            config=_config(prompts.ALERT_SYSTEM_PROMPT, OwnerAlert, 0.3),
        )
        alert = resp.parsed if isinstance(resp.parsed, OwnerAlert) else OwnerAlert.model_validate_json(resp.text or "")
        if not alert.title.strip() or not alert.body.strip():
            raise ValueError("empty alert")
        return OwnerAlert(title=alert.title[:80], body=alert.body[:300]), True
    except Exception as e:
        log.warning("gemini alert failed, using template", extra={"fields": {"error": type(e).__name__}})
        return fallback_alert(kind, language), False


# ---------- evidence pack ----------
def draft_evidence_report(case_data: dict) -> str | None:
    try:
        resp = client().models.generate_content(
            model=get_settings().gemini_model,
            contents=prompts.EVIDENCE_USER_TEMPLATE.format(case_json=json.dumps(case_data, ensure_ascii=False, default=str)),
            config=types.GenerateContentConfig(system_instruction=prompts.EVIDENCE_SYSTEM_PROMPT, temperature=0.2,
                                               safety_settings=SAFETY_OFF),
        )
        return (resp.text or "").strip() or None
    except Exception as e:
        log.warning("gemini evidence report failed", extra={"fields": {"error": type(e).__name__}})
        return None
