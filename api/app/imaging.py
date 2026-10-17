"""Untrusted image intake: sniff with Pillow, fix orientation, strip EXIF, bound size."""
import io
from dataclasses import dataclass

import numpy as np
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
Image.MAX_IMAGE_PIXELS = 40_000_000  # refuse decompression bombs


@dataclass
class CleanImage:
    jpeg: bytes  # re-encoded, EXIF-free; the only bytes we store or send to Gemini
    bgr: np.ndarray  # for the face engine
    width: int
    height: int


def clean_image(data: bytes, max_bytes: int, max_side: int = 1600, quality: int = 88) -> CleanImage:
    if len(data) > max_bytes:
        raise HTTPException(413, f"Image is too large (max {max_bytes // 1_000_000} MB)")
    try:
        img = Image.open(io.BytesIO(data))
        if img.format not in ALLOWED_FORMATS:
            raise HTTPException(415, "Please upload a JPEG, PNG or WebP image")
        img = ImageOps.exif_transpose(img).convert("RGB")
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError):
        raise HTTPException(415, "That file is not a readable image")
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)  # no exif= argument, so metadata is dropped
    rgb = np.asarray(img)
    return CleanImage(jpeg=buf.getvalue(), bgr=rgb[:, :, ::-1].copy(), width=img.width, height=img.height)
