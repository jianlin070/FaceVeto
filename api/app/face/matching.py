"""1:N matching of a face embedding against opted-in templates. Internal only: never exposed as an API."""
from dataclasses import dataclass

import numpy as np
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from google.cloud.firestore_v1.vector import Vector

from app.config import get_settings
from app.db import get_db

COLLECTION = "face_templates"


@dataclass(frozen=True)
class Match:
    uid: str
    similarity: float


def top_matches(embedding: np.ndarray, limit: int = 3) -> list[Match]:
    """Nearest templates by cosine similarity, best first."""
    if get_settings().match_backend == "memory":
        return _memory_top(embedding, limit)
    q = get_db().collection(COLLECTION).find_nearest(
        vector_field="embedding",
        query_vector=Vector(embedding.astype(float).tolist()),
        distance_measure=DistanceMeasure.COSINE,
        limit=limit,
        distance_result_field="vector_distance",
    )
    # COSINE distance = 1 - cosine similarity
    return [Match(d.id, round(1.0 - float(d.get("vector_distance")), 4)) for d in q.stream()]


def _memory_top(embedding: np.ndarray, limit: int) -> list[Match]:
    docs = list(get_db().collection(COLLECTION).stream())
    if not docs:
        return []
    mat = np.array([list(d.get("embedding")) for d in docs], dtype=np.float32)
    sims = mat @ embedding.astype(np.float32)
    order = np.argsort(-sims)[:limit]
    return [Match(docs[i].id, round(float(sims[i]), 4)) for i in order]


def best_match_per_uid(face_matches: list[list[Match]], threshold: float) -> dict[str, float]:
    """Collapse matches from all faces in an image to {uid: max similarity} above threshold."""
    best: dict[str, float] = {}
    for matches in face_matches:
        for m in matches:
            if m.similarity >= threshold and m.similarity > best.get(m.uid, -1.0):
                best[m.uid] = m.similarity
    return best
