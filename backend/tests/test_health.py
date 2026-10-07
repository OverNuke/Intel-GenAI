from fastapi.testclient import TestClient

from app.main import app


def test_health_is_served_under_the_api_prefix() -> None:
    response = TestClient(app).get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
