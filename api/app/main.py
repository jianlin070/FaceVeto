import json
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.admin.router import router as admin_router
from app.agent import gemini
from app.config import get_settings
from app.db import firebase_app, get_bucket, get_db
from app.cases.router import router as cases_router
from app.demo.router import router as demo_router
from app.enrolment.router import router as enrolment_router
from app.face import engine
from app.media.router import router as media_router
from app.scan.router import router as posts_router
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
    # Build shared clients once, before requests arrive on several threads.
    firebase_app(), get_db(), get_bucket(), gemini.client()
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


@app.middleware("http")
async def no_store_by_default(request, call_next):
    # Firebase Hosting's CDN caches responses without Cache-Control (even a 404 for max-age=600).
    # API answers depend on the caller, so nothing is cacheable unless a route says so.
    response = await call_next(request)
    response.headers.setdefault("Cache-Control", "no-store")
    return response


app.include_router(users_router)
app.include_router(enrolment_router)
app.include_router(posts_router)
app.include_router(media_router)
app.include_router(cases_router)
app.include_router(admin_router)
if settings.demo_mode:
    app.include_router(demo_router)


# Cloud Run reserves /healthz on its own domain, so /api/healthz is the public probe.
@app.get("/healthz")
@app.get("/api/healthz")
def healthz():
    return {"ok": True, "version": app.version, "model_loaded": engine.is_loaded(), "demo_mode": settings.demo_mode}
