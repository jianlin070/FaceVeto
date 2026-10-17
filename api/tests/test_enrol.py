import numpy as np
import pytest

from app.enrolment.router import EnrolError, build_template


def unit(v):
    v = np.asarray(v, dtype=np.float32)
    return v / np.linalg.norm(v)


def test_template_is_normalised_mean_of_consistent_frames():
    rng = np.random.default_rng(0)
    base = unit(rng.normal(size=512))
    frames = [unit(base + 0.02 * rng.normal(size=512)) for _ in range(4)]
    template, intra = build_template(frames, intra_min=0.6)
    assert abs(np.linalg.norm(template) - 1) < 1e-5
    assert intra >= 0.6
    assert float(template @ base) > 0.95


def test_rejects_frames_of_different_people():
    rng = np.random.default_rng(1)
    a, b = unit(rng.normal(size=512)), unit(rng.normal(size=512))
    with pytest.raises(EnrolError, match="same person"):
        build_template([a, a, b], intra_min=0.6)


def test_requires_three_frames():
    with pytest.raises(EnrolError):
        build_template([unit(np.ones(512))] * 2, intra_min=0.6)
