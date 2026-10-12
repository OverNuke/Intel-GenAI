"""POST /api/tickets/{id}/participants, PATCH /api/tickets/{id}, POST /api/tickets/{id}/close."""

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.api.deps import get_session_codec, get_user_directory, get_user_repository
from app.modules.tickets.api.deps import get_clock, get_ticket_repository
from app.seed.data import EVENTS, RECEIPTS
from tests.modules.auth.fakes import FakeSessionCodec, InMemoryUserDirectory, InMemoryUserRepository
from tests.modules.tickets.fakes import InMemoryTicketRepository

NOW = datetime(2026, 10, 11, 12, 0, tzinfo=UTC)


@pytest.fixture
def client() -> Iterator[TestClient]:
    users, codec = InMemoryUserRepository(), FakeSessionCodec()
    repo = InMemoryTicketRepository(events=EVENTS, receipts=RECEIPTS)
    app.dependency_overrides[get_user_repository] = lambda: users
    app.dependency_overrides[get_user_directory] = lambda: InMemoryUserDirectory()
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


def _detail(client: TestClient, user_id: str, display_id: str) -> dict[str, object]:
    return _as(client, user_id).get(f"/api/tickets/{display_id}").json()  # type: ignore[no-any-return]


# --- participants


def test_participants_are_added_and_the_detail_lists_their_names(client: TestClient) -> None:
    response = _as(client, "ana").post(
        "/api/tickets/INC0001055/participants", json={"names": ["sara"], "confirmed": True}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["added"] == ["Sara Molina"]
    assert body["ambiguous"] == [] and body["unknown"] == [] and body["over_limit"] == []
    assert body["ticket"]["participants"] == ["Sara Molina"]
    assert body["ticket"]["events"][-1]["kind"] == "participants_added"
    assert _detail(client, "ana", "INC0001055")["participants"] == ["Sara Molina"]


def test_unknown_names_come_back_as_a_structured_warning_not_an_error(client: TestClient) -> None:
    response = _as(client, "ana").post(
        "/api/tickets/INC0001055/participants", json={"names": ["Pedro"], "confirmed": True}
    )
    assert response.status_code == 200
    assert response.json()["unknown"] == ["Pedro"]
    assert response.json()["added"] == []


def test_participants_without_confirmation_never_write(client: TestClient) -> None:
    for body in ({"names": ["sara"]}, {"names": ["sara"], "confirmed": False}):
        response = _as(client, "ana").post("/api/tickets/INC0001055/participants", json=body)
        assert response.status_code == 400
        assert response.json()["reason"] == "missing-human-confirmation"
        assert response.json()["message"]
    assert _detail(client, "ana", "INC0001055")["participants"] == []


def test_participants_identity_cannot_be_spoofed_through_the_body(client: TestClient) -> None:
    spoof = {"names": ["sara"], "confirmed": True, "requester_id": "ana", "by": "human"}
    assert _as(client, "sara").post(
        "/api/tickets/INC0001055/participants", json=spoof
    ).status_code == 422
    # Someone else's ticket is a plain 404, with or without extras.
    other = {"names": ["sara"], "confirmed": True}
    assert _as(client, "sara").post(
        "/api/tickets/INC0001055/participants", json=other
    ).status_code == 404
    assert _as(client, "luis").post(
        "/api/tickets/INC0001055/participants", json=other
    ).status_code == 404
    assert _detail(client, "ana", "INC0001055")["participants"] == []


def test_participants_need_a_session_and_a_valid_ticket(client: TestClient) -> None:
    body = {"names": ["sara"], "confirmed": True}
    assert client.post("/api/tickets/INC0001055/participants", json=body).status_code == 401
    _as(client, "ana")
    assert client.post("/api/tickets/INC0009999/participants", json=body).status_code == 404
    assert client.post("/api/tickets/nope/participants", json=body).status_code == 404
    blank = {"names": ["  "], "confirmed": True}
    assert client.post("/api/tickets/INC0001055/participants", json=blank).status_code == 422
    closed = client.post("/api/tickets/INC0001053/participants", json=body)
    assert closed.status_code == 409


# --- update


def test_patch_updates_the_allowed_fields_and_logs_the_change(client: TestClient) -> None:
    response = _as(client, "ana").patch(
        "/api/tickets/INC0001055", json={"summary": "Correo sin sincronizar", "confirmed": True}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["summary"] == "Correo sin sincronizar"
    assert body["events"][-1]["kind"] == "updated"
    assert "Correo sin sincronizar" in body["events"][-1]["body"]


def test_patch_without_confirmation_never_writes(client: TestClient) -> None:
    before = _detail(client, "ana", "INC0001055")["summary"]
    for body in ({"summary": "x"}, {"summary": "x", "confirmed": False}):
        response = _as(client, "ana").patch("/api/tickets/INC0001055", json=body)
        assert response.status_code == 400
    assert _detail(client, "ana", "INC0001055")["summary"] == before


def test_patch_rejects_unknown_fields_empty_changes_and_closed_tickets(client: TestClient) -> None:
    _as(client, "ana")
    for body in (
        {"status": "closed", "confirmed": True},
        {"requester_id": "luis", "confirmed": True},
        {"assignee_id": "sara", "confirmed": True},
    ):
        assert client.patch("/api/tickets/INC0001055", json=body).status_code == 422
    empty = client.patch("/api/tickets/INC0001055", json={"confirmed": True})
    assert (empty.status_code, empty.json()["reason"]) == (422, "no-changes")
    nulled = client.patch("/api/tickets/INC0001055", json={"summary": None, "confirmed": True})
    assert (nulled.status_code, nulled.json()["reason"]) == (422, "invalid-value")
    closed = client.patch("/api/tickets/INC0001053", json={"summary": "x", "confirmed": True})
    assert (closed.status_code, closed.json()["reason"]) == (409, "ticket-closed")


def test_patch_of_a_foreign_ticket_is_404_for_everyone_but_the_requester(
    client: TestClient,
) -> None:
    for user_id in ("luis", "sara"):
        response = _as(client, user_id).patch(
            "/api/tickets/INC0001055", json={"summary": "x", "confirmed": True}
        )
        assert response.status_code == 404
    assert _as(client, "ana").patch("/api/tickets/nope", json={"summary": "x"}).status_code == 404


# --- close


def test_requester_closes_her_resolved_ticket(client: TestClient) -> None:
    response = _as(client, "ana").post("/api/tickets/INC0001054/close", json={"confirmed": True})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "closed"
    assert body["events"][-1]["kind"] == "closed"


def test_it_closes_a_resolved_ticket(client: TestClient) -> None:
    response = _as(client, "luis").post("/api/tickets/INC0001054/close", json={"confirmed": True})
    assert response.status_code == 200
    assert response.json()["status"] == "closed"
    assert _detail(client, "ana", "INC0001054")["status"] == "closed"


def test_close_without_confirmation_never_executes(client: TestClient) -> None:
    for body in ({}, {"confirmed": False}):
        response = _as(client, "ana").post("/api/tickets/INC0001054/close", json=body)
        assert response.status_code == 400
        assert response.json()["reason"] == "missing-human-confirmation"
    assert _detail(client, "ana", "INC0001054")["status"] == "resolved"


def test_close_is_a_409_unless_the_ticket_is_resolved(client: TestClient) -> None:
    response = _as(client, "ana").post("/api/tickets/INC0001055/close", json={"confirmed": True})
    assert response.status_code == 409
    assert response.json()["reason"] == "not-resolved"
    assert response.json()["message"]
    again = _as(client, "ana").post("/api/tickets/INC0001053/close", json={"confirmed": True})
    assert (again.status_code, again.json()["reason"]) == (409, "already-closed")
    assert _detail(client, "ana", "INC0001055")["status"] == "in_progress"


def test_close_cannot_be_spoofed_and_hides_foreign_tickets(client: TestClient) -> None:
    spoof = {"confirmed": True, "by": "human", "requester_id": "ana"}
    assert _as(client, "sara").post("/api/tickets/INC0001054/close", json=spoof).status_code == 422
    plain = {"confirmed": True}
    assert _as(client, "sara").post("/api/tickets/INC0001054/close", json=plain).status_code == 404
    assert client.post("/api/tickets/INC0009999/close", json=plain).status_code == 404
    assert _detail(client, "ana", "INC0001054")["status"] == "resolved"


def test_close_needs_a_session(client: TestClient) -> None:
    response = client.post("/api/tickets/INC0001054/close", json={"confirmed": True})
    assert response.status_code == 401
