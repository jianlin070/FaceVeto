"""Public dataset faces (LFW via scikit-learn) for automated tests and evals only. Never demo users."""
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

CACHE = str(Path(__file__).resolve().parents[1] / "eval" / ".cache")


@lru_cache
def people(min_faces: int = 20):
    from sklearn.datasets import fetch_lfw_people

    return fetch_lfw_people(min_faces_per_person=min_faces, color=True, resize=1.0, slice_=None, data_home=CACHE)


def to_pil(arr: np.ndarray) -> Image.Image:
    a = arr if arr.max() > 1.5 else arr * 255
    return Image.fromarray(a.astype(np.uint8))


def person_photos(person_index: int, n: int, min_faces: int = 20) -> list[Image.Image]:
    p = people(min_faces)
    idx = np.where(p.target == person_index)[0][:n]
    return [to_pil(p.images[i]) for i in idx]


def video_like_frames(photo: Image.Image, n: int = 4) -> list[Image.Image]:
    """Small brightness and crop changes, like consecutive frames from a webcam."""
    w, h = photo.size
    frames = []
    for k in range(n):
        f = ImageEnhance.Brightness(photo).enhance(0.92 + 0.05 * k)
        d = 2 + k
        frames.append(f.crop((d, d, w - d, h - d)).resize((w * 2, h * 2)))
    return frames
