"""POST /api/tickets: the human-confirmed submission (in-memory repositories, fixed clock)."""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.api.deps import get_session_codec, get_user_repository
from app.modules.tickets.api.deps import get_clock, get_ticket_repository
from tests.modules.auth.fakes import FakeSessionCodec, InMemoryUserRepository
from tests.modules.tickets.fakes import InMemoryTicketRepository

NOW = datetime(2026, 10, 9, 12, 0, tzinfo=UTC)

RECEIPT = {
    "understood": "La impresora del piso 2 no imprime.",
    "reviewed": ["Datos obligatorios completos", "Destino sugerido: Soporte de impresión"],
    "not_done": [],
    "permissions_notice": None,
    "missing_data": [],
    "target_group": "Soporte de impresión",
}


@pytest.fixture
def repo() -> InMemoryTicketRepository:
    return InMemoryTicketRepository()


@pytest.fixture
def client(repo: InMemoryTicketRepository) -> Iterator[TestClient]:
    users, codec = InMemoryUserRepository(), FakeSessionCodec()
    app.dependency_overrides[get_user_repository] = lambda: users
    app.dependency_overrides[get_session_codec] = lambda: codec
    app.dependency_overrides[get_ticket_repository] = lambda: repo
    app.dependency_overrides[get_clock] = lambda: (lambda: NOW)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _as(client: TestClient, user_id: str) -> TestClient:
    client.cookies.set("ariadna_session", FakeSessionCodec.PREFIX + user_id)
    return client


def _body(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "draft": {
            "service": "printing",
            "summary": "La impresora no imprime",
            "description": "Los documentos se quedan en la cola.",
        },
        "confirmed": True,
    }
    return {**base, **over}


def test_requires_a_session(client: TestClient) -> None:
    assert client.post("/api/tickets", json=_body()).status_code == 401


def test_s_ts_1_confirmed_draft_is_created_as_the_next_ticket_and_listed_first(
    client: TestClient,
) -> None:
    _as(client, "ana")
    response = client.post("/api/tickets", json=_body())
    assert response.status_code == 201
    body = response.json()
    assert body["id"] == "INC0001061"
    assert body["status"] == "new"
    assert body["awaiting_user"] is False
    assert body["via_ariadna"] is False
    assert body["receipt"] is None
    assert body["assigned_group"] == "Soporte de impresión"
    assert body["assignee_name"] is None
    assert [e["kind"] for e in body["events"]] == ["created"]
    listing = client.get("/api/tickets/mine").json()
    assert listing["tickets"][0]["id"] == "INC0001061"
    assert listing["summary"]["open"] == 7


def test_s_ts_2_without_the_confirmation_flag_it_is_refused_and_nothing_changes(
    client: TestClient,
) -> None:
    _as(client, "ana")
    missing = {k: v for k, v in _body().items() if k != "confirmed"}
    for body in (missing, _body(confirmed=False)):
        response = client.post("/api/tickets", json=body)
        assert response.status_code == 400
        assert response.json() == {"reason": "missing-human-confirmation"}
    assert len(client.get("/api/tickets/mine").json()["tickets"]) == 8


def test_s_ts_3_a_requester_in_the_body_is_rejected_never_honoured(client: TestClient) -> None:
    _as(client, "ana")
    for extra in ({"requester_id": "luis"}, {"by": "human"}):
        response = client.post("/api/tickets", json=_body(**extra))
        assert response.status_code == 422
    nested = _body()
    nested["draft"]["requester_id"] = "luis"
    assert client.post("/api/tickets", json=nested).status_code == 422
    assert client.get("/api/tickets/mine").json()["tickets"][0]["id"] == "INC0001060"


def test_the_ticket_always_belongs_to_the_session_user(client: TestClient) -> None:
    _as(client, "luis")
    created = client.post("/api/tickets", json=_body())
    assert created.status_code == 201
    mine = client.get("/api/tickets/mine").json()["tickets"]
    assert [t["id"] for t in mine] == ["INC0001061"]
    assert _as(client, "ana").get("/api/tickets/INC0001061").status_code == 404


def test_s_ts_4_incomplete_draft_is_422_with_a_reason_and_creates_nothing(
    client: TestClient,
) -> None:
    _as(client, "ana")
    draft = {"service": "printing", "summary": "   ", "description": "x"}
    response = client.post("/api/tickets", json=_body(draft=draft))
    assert response.status_code == 422
    assert response.json() == {"reason": "incomplete-draft"}
    assert len(client.get("/api/tickets/mine").json()["tickets"]) == 8
    # The sequence was not consumed: the next valid ticket is still INC0001061.
    assert client.post("/api/tickets", json=_body()).json()["id"] == "INC0001061"


def test_unknown_service_is_422_unknown_service(client: TestClient) -> None:
    _as(client, "ana")
    draft = {"service": "unknown-x", "summary": "a", "description": "b"}
    response = client.post("/api/tickets", json=_body(draft=draft))
    assert response.status_code == 422
    assert response.json() == {"reason": "unknown-service"}


def test_s_ts_5_the_receipt_is_stored_returned_and_shown_in_the_detail(
    client: TestClient,
) -> None:
    _as(client, "ana")
    created = client.post("/api/tickets", json=_body(receipt=RECEIPT)).json()
    assert created["via_ariadna"] is True
    assert created["receipt"]["understood"] == RECEIPT["understood"]
    assert created["receipt"]["target_group"] == "Soporte de impresión"
    assert created["receipt"]["not_done"][-1].startswith("La persona revisó y presionó")
    detail = client.get("/api/tickets/INC0001061").json()
    assert detail["receipt"] == created["receipt"]
    assert detail["via_ariadna"] is True


def test_impact_and_urgency_set_priority_and_sla(
    client: TestClient, repo: InMemoryTicketRepository
) -> None:
    _as(client, "ana")
    draft = {**_body()["draft"], "impact": "high", "urgency": "high"}
    assert client.post("/api/tickets", json=_body(draft=draft)).status_code == 201
    import asyncio

    record = asyncio.run(repo.get(1061))
    assert record is not None
    assert record.view.ticket.priority == "critical"
    assert record.view.ticket.sla_due_at == datetime(2026, 10, 9, 16, 0, tzinfo=UTC)


def test_s_ts_6_the_same_idempotency_key_creates_one_ticket(client: TestClient) -> None:
    _as(client, "ana")
    first = client.post("/api/tickets", json=_body(idempotency_key="k-1"))
    second = client.post("/api/tickets", json=_body(idempotency_key="k-1"))
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"] == "INC0001061"
    assert len(client.get("/api/tickets/mine").json()["tickets"]) == 9


def test_invalid_receipt_shape_or_oversized_text_is_422(client: TestClient) -> None:
    _as(client, "ana")
    assert client.post("/api/tickets", json=_body(receipt={"reviewed": []})).status_code == 422
    huge = {**RECEIPT, "understood": "x" * 501}
    assert client.post("/api/tickets", json=_body(receipt=huge)).status_code == 422
