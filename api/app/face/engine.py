"""InsightFace (buffalo_l: RetinaFace detector + ArcFace 512-d) on CPU, loaded once per process."""
import logging
import threading
import time
from dataclasses import dataclass

import numpy as np

from app.config import get_settings

log = logging.getLogger(__name__)
MODEL_NAME = "buffalo_l"
TEMPLATE_VERSION = "buffalo_l-v1"

_app = None
_lock = threading.Lock()


@dataclass
class DetectedFace:
    bbox: tuple[float, float, float, float]  # x1, y1, x2, y2
    det_score: float
    embedding: np.ndarray  # 512-d, L2-normalised

    @property
    def min_side(self) -> float:
        x1, y1, x2, y2 = self.bbox
        return min(x2 - x1, y2 - y1)


def get_app():
    global _app
    if _app is None:
        with _lock:
            if _app is None:
                from insightface.app import FaceAnalysis

                t0 = time.perf_counter()
                app = FaceAnalysis(name=MODEL_NAME, root=get_settings().face_model_root,
                                   providers=["CPUExecutionProvider"], allowed_modules=["detection", "recognition"])
                app.prepare(ctx_id=-1, det_size=(640, 640))
                _app = app
                log.info("face model loaded", extra={"fields": {"load_ms": int((time.perf_counter() - t0) * 1000)}})
    return _app


def is_loaded() -> bool:
    return _app is not None


def detect_and_embed(bgr: np.ndarray, min_score: float = 0.5, min_side: float = 40) -> list[DetectedFace]:
    faces = []
    for f in get_app().get(bgr):
        if f.normed_embedding is None:
            continue
        face = DetectedFace(tuple(float(v) for v in f.bbox), float(f.det_score), np.asarray(f.normed_embedding, dtype=np.float32))
        if face.det_score >= min_score and face.min_side >= min_side:
            faces.append(face)
    return faces
