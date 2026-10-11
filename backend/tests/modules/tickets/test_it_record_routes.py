"""T2 API: GET /api/it/tickets/{id} and POST /api/it/tickets/{id}/contact."""

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.api.deps import get_session_codec, get_user_repository
from app.modules.tickets.api.deps import get_clock, get_ticket_repository
from app.seed.data import EVENTS, RECEIPTS
from tests.modules.auth.fakes import FakeSessionCodec, InMemoryUserRepository
from tests.modules.tickets.fakes import InMemoryTicketRepository

NOW = datetime(2026, 1, 14, 10, 0, tzinfo=UTC)


@pytest.fixture
def client() -> Iterator[TestClient]:
    users, codec = InMemoryUserRepository(), FakeSessionCodec()
    repo = InMemoryTicketRepository(events=EVENTS, receipts=RECEIPTS)
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


# --- GET record


def test_record_needs_a_session_and_the_it_role(client: TestClient) -> None:
    assert client.get("/api/it/tickets/INC0001056").status_code == 401
    for user_id in ("ana", "sara"):
        assert _as(client, user_id).get("/api/it/tickets/INC0001056").status_code == 403


def test_it_gets_any_requesters_ticket_with_sla_receipt_and_the_full_log(
    client: TestClient,
) -> None:
    body = _as(client, "luis").get("/api/it/tickets/INC0001056").json()
    assert body["id"] == "INC0001056"
    assert body["requester_name"] == "Ana Ruiz"
    assert body["priority"] == "critical"
    assert body["sla_state"] == "overdue"
    assert body["awaiting_user"] is True
    assert body["assignee_name"] == "Luis Herrera"
    assert [e["kind"] for e in body["events"]] == ["created", "assigned", "contact_requested"]
    assert body["events"][0]["author_name"] == "Ana Ruiz"
    assert body["events"][2]["author_name"] == "Luis Herrera"
    assert "requester_id" not in body


def test_s_it_12_the_receipt_of_a_conversation_ticket_is_shown(client: TestClient) -> None:
    body = _as(client, "luis").get("/api/it/tickets/INC0001055").json()
    assert body["via_ariadna"] is True
    assert body["receipt"]["target_group"] == "Soporte de cuentas y accesos"
    assert _as(client, "luis").get("/api/it/tickets/INC0001058").json()["receipt"] is None


def test_unknown_or_malformed_id_is_404(client: TestClient) -> None:
    _as(client, "luis")
    assert client.get("/api/it/tickets/INC0009999").status_code == 404
    assert client.get("/api/it/tickets/garbage").status_code == 404


# --- POST contact


def test_s_it_9_a_user_cannot_contact_and_nothing_changes(client: TestClient) -> None:
    response = _as(client, "ana").post(
        "/api/it/tickets/INC0001060/contact", json={"message": "hola"}
    )
    assert response.status_code == 403
    after = _as(client, "luis").get("/api/it/tickets/INC0001060").json()
    assert after["awaiting_user"] is False


def test_s_it_8_contact_marks_pending_and_ana_sees_the_message_in_her_ticket(
    client: TestClient,
) -> None:
    message = "Confirma la extensión del teléfono"
    response = _as(client, "luis").post(
        "/api/it/tickets/INC0001060/contact", json={"message": message}
    )
    assert response.status_code == 200
    record = response.json()
    assert record["awaiting_user"] is True
    assert record["status"] == "assigned"
    assert record["events"][-1]["kind"] == "contact_requested"
    assert record["events"][-1]["body"] == message

    detail = _as(client, "ana").get("/api/tickets/INC0001060").json()
    assert detail["awaiting_user"] is True
    assert detail["contact_notice"] == message
    assert detail["events"][-1]["body"] == message


def test_contact_without_a_message_is_allowed(client: TestClient) -> None:
    response = _as(client, "luis").post("/api/it/tickets/INC0001060/contact", json={})
    assert response.status_code == 200
    assert response.json()["awaiting_user"] is True
    detail = _as(client, "ana").get("/api/tickets/INC0001060").json()
    assert detail["contact_notice"] is None


def test_s_it_10_a_closed_ticket_answers_409_and_stays_untouched(client: TestClient) -> None:
    response = _as(client, "luis").post(
        "/api/it/tickets/INC0001053/contact", json={"message": "hola"}
    )
    assert response.status_code == 409
    assert response.json() == {"reason": "ticket-finished"}
    assert _as(client, "luis").get("/api/it/tickets/INC0001053").json()["awaiting_user"] is False


def test_s_it_11_contacting_a_pending_ticket_is_ok_and_stays_pending(client: TestClient) -> None:
    response = _as(client, "luis").post(
        "/api/it/tickets/INC0001056/contact", json={"message": "Otro dato"}
    )
    assert response.status_code == 200
    assert response.json()["awaiting_user"] is True


def test_unknown_ticket_is_404_and_a_long_message_is_422(client: TestClient) -> None:
    _as(client, "luis")
    assert client.post("/api/it/tickets/INC0009999/contact", json={}).status_code == 404
    long = client.post("/api/it/tickets/INC0001060/contact", json={"message": "x" * 501})
    assert long.status_code == 422


def test_extra_fields_are_rejected(client: TestClient) -> None:
    response = _as(client, "luis").post(
        "/api/it/tickets/INC0001060/contact", json={"message": "x", "awaiting_user": False}
    )
    assert response.status_code == 422
