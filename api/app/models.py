from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

Language = Literal["en", "ms", "zh"]


# ---------- users ----------
class ProfileIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=60)
    handle: str = Field(pattern=r"^[a-z0-9_]{3,20}$")
    preferred_language: Language = "en"


class Protection(BaseModel):
    status: Literal["none", "active"] = "none"
    enrolled_at: str | None = None
    template_version: str | None = None


class Me(BaseModel):
    uid: str
    email: str
    is_admin: bool
    profile_complete: bool
    display_name: str = ""
    handle: str = ""
    preferred_language: Language = "en"
    protection: Protection = Protection()
    account_age_days: int = 0
    is_demo: bool = False


# ---------- AI assessment ----------
class HarmCategory(str, Enum):
    gambling_promotion = "gambling_promotion"
    sexual_or_intimate = "sexual_or_intimate"
    scam_or_fraud = "scam_or_fraud"
    impersonation = "impersonation"
    harassment_or_defamation = "harassment_or_defamation"
    other_harmful = "other_harmful"
    benign = "benign"


class HarmAssessment(BaseModel):
    is_harmful: bool
    category: HarmCategory
    severity: Literal["none", "low", "medium", "high"]
    confidence: float = Field(ge=0, le=1)
    text_in_image: str
    languages: list[str]
    evidence: list[str]
    reasoning: str
    recommended_action: Literal["allow", "allow_and_notify", "hold"]


class OwnerAlert(BaseModel):
    title: str
    body: str


# ---------- posts and cases ----------
class PostOut(BaseModel):
    post_id: str
    author_handle: str
    author_display_name: str = ""
    caption: str
    status: str  # published | under_review | removed (poster view never shows match details)
    created_at: str | None = None
    image_url: str | None = None  # None for text-only posts
    is_mine: bool = False
    edited: bool = False


class PostEditIn(BaseModel):
    caption: str = Field(max_length=2000)


class RespondIn(BaseModel):
    response: Literal["not_me", "its_me"]


class AdminActionIn(BaseModel):
    action: Literal["takedown", "release"]
    note: str = Field(default="", max_length=500)


class DemoLoginIn(BaseModel):
    who: Literal["alice", "bob", "admin"]
