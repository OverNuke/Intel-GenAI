from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.api.deps import get_session_codec, get_user_repository
from tests.modules.auth.fakes import FakeSessionCodec, InMemoryUserRepository


@pytest.fixture
def client() -> Iterator[TestClient]:
    users, codec = InMemoryUserRepository(), FakeSessionCodec()
    app.dependency_overrides[get_user_repository] = lambda: users
    app.dependency_overrides[get_session_codec] = lambda: codec
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _as(client: TestClient, user_id: str) -> TestClient:
    client.cookies.set("ariadna_session", FakeSessionCodec.PREFIX + user_id)
    return client


def test_catalog_requires_a_session(client: TestClient) -> None:
    assert client.get("/api/catalog/services").status_code == 401
    assert client.get("/api/catalog/services/printing").status_code == 401


def test_every_role_gets_the_six_services_in_catalog_order(client: TestClient) -> None:
    for user_id in ("ana", "luis", "sara"):
        response = _as(client, user_id).get("/api/catalog/services")
        assert response.status_code == 200
        assert [s["key"] for s in response.json()] == [
            "access",
            "printing",
            "email",
            "network",
            "hardware",
            "software",
        ]


def test_service_payload_carries_the_card_content(client: TestClient) -> None:
    body = _as(client, "ana").get("/api/catalog/services/printing").json()
    assert body == {
        "key": "printing",
        "label": "Impresión",
        "description": "Impresoras y escáneres",
        "examples": ["La impresora no imprime", "Se atora el papel", "El escáner no envía"],
        "have_at_hand": ["El piso o el nombre de la impresora."],
        "handled_by": "Soporte de impresión",
        "requires_manager_authorization": False,
    }


def test_only_software_requires_manager_authorization(client: TestClient) -> None:
    services = _as(client, "ana").get("/api/catalog/services").json()
    flagged = [s["key"] for s in services if s["requires_manager_authorization"]]
    assert flagged == ["software"]


def test_unknown_service_is_404(client: TestClient) -> None:
    assert _as(client, "ana").get("/api/catalog/services/unknown-x").status_code == 404
