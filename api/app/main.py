from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

settings = get_settings()

app = FastAPI(title="FaceVeto API", version="0.1.0")

if settings.allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.allowed_origins.split(",") if o.strip()],
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/healthz")
@app.get("/api/healthz")
def healthz():
    return {"ok": True, "version": app.version, "model_loaded": False}
