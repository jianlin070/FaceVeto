from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gcp_project: str = "faceveto-2026"
    gcp_region: str = "asia-southeast1"
    gemini_model: str = "gemini-3.6-flash"
    gemini_location: str = "global"
    gemini_timeout_ms: int = 20000
    gemini_thinking: str = "low"  # minimal | low | medium | high, or "" for the model default
    media_bucket: str = "faceveto-2026-faceveto-media"

    match_threshold: float = 0.45
    dup_threshold: float = 0.55
    enrol_intra_min: float = 0.60
    match_backend: str = "firestore"  # firestore | memory

    face_model_root: str = "~/.insightface"
    load_face_model: bool = True

    demo_mode: bool = False
    # Service account used to sign custom tokens when running with user ADC locally.
    # On Cloud Run the runtime service account is discovered automatically.
    signer_service_account: str = ""
    allowed_origins: str = ""
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
