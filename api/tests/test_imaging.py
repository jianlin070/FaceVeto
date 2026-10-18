import io

import pytest
from fastapi import HTTPException
from PIL import Image

from app.imaging import clean_image, from_stored
from app.scan.router import post_out


def _encode(fmt: str, **kw) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), "red").save(buf, fmt, **kw)
    return buf.getvalue()


def test_iphone_multi_picture_jpeg_is_accepted():
    """iPhone HDR and portrait photos are MPO: a JPEG with extra frames."""
    mpo = _encode("MPO", save_all=True, append_images=[Image.new("RGB", (16, 16), "blue")])
    img = clean_image(mpo, max_bytes=8_000_000)
    assert (img.width, img.height) == (64, 48) and img.jpeg[:2] == b"\xff\xd8"


def test_unsupported_format_is_rejected():
    with pytest.raises(HTTPException) as e:
        clean_image(_encode("GIF"), max_bytes=8_000_000)
    assert e.value.status_code == 415


def test_stored_image_is_not_re_encoded():
    jpeg = clean_image(_encode("PNG"), max_bytes=8_000_000).jpeg
    assert from_stored(jpeg).jpeg is jpeg


def test_poster_view_of_text_post_has_no_image_and_no_match_fields():
    out = post_out("p1", {"author_uid": "bob", "caption": "hi", "status": "held", "has_image": False,
                          "scan": {"matched": [{"uid": "alice"}]}}, viewer_uid="bob")
    assert out.image_url is None and out.status == "under_review" and out.is_mine
    assert set(out.model_dump()) == {"post_id", "author_handle", "author_display_name", "caption", "status",
                                     "created_at", "image_url", "is_mine", "edited"}
