import json
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.demo.router import router as demo_router
from app.enrolment.router import router as enrolment_router
from app.face import engine
from app.users.router import router as users_router

settings = get_settings()


class JsonFormatter(logging.Formatter):
    """One JSON object per line so Cloud Logging parses severity and fields."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {"severity": record.levelname, "message": record.getMessage(), "logger": record.name}
        entry |= getattr(record, "fields", {})
        if record.exc_info:
            entry["stack_trace"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=settings.log_level, handlers=[handler], force=True)



@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.load_face_model:
        engine.get_app()  # load at startup so the first scan is not slow
    yield


app = FastAPI(title="FaceVeto API", version="0.3.0", lifespan=lifespan)

if settings.allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.allowed_origins.split(",") if o.strip()],
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(users_router)
app.include_router(enrolment_router)
if settings.demo_mode:
    app.include_router(demo_router)


# Cloud Run reserves /healthz on its own domain, so /api/healthz is the public probe.
@app.get("/healthz")
@app.get("/api/healthz")
def healthz():
    return {"ok": True, "version": app.version, "model_loaded": engine.is_loaded(), "demo_mode": settings.demo_mode}
