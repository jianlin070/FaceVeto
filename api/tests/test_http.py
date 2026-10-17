from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)  # no context manager: lifespan (cloud clients, face model) does not run


def test_errors_are_not_cacheable_by_the_cdn():
    r = client.get("/api/me")
    assert r.status_code == 401
    assert r.headers["cache-control"] == "no-store"


def test_no_face_search_endpoint_exists():
    """Privacy rule: nothing takes a face and returns an identity."""
    paths = app.openapi()["paths"]
    image_in = {p for p, ops in paths.items() for op in ops.values()
                if "multipart/form-data" in str(op.get("requestBody", {}))}
    assert image_in == {"/api/enrol", "/api/posts"}
