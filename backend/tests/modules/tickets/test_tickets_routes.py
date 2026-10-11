"""Tickets read API through TestClient; repositories are in memory, no database is touched."""

from collections.abc import Iterator
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.api.deps import get_session_codec, get_user_repository
from app.modules.tickets.api.deps import get_ticket_repository
from app.seed.data import EVENTS, RECEIPTS, TICKETS
from tests.modules.auth.fakes import FakeSessionCodec, InMemoryUserRepository
from tests.modules.tickets.fakes import InMemoryTicketRepository


def _client(repo: InMemoryTicketRepository) -> TestClient:
    users, codec = InMemoryUserRepository(), FakeSessionCodec()
    app.dependency_overrides[get_user_repository] = lambda: users
    app.dependency_overrides[get_session_codec] = lambda: codec
    app.dependency_overrides[get_ticket_repository] = lambda: repo
    return TestClient(app)


@pytest.fixture
def client() -> Iterator[TestClient]:
    try:
        yield _client(InMemoryTicketRepository())
    finally:
        app.dependency_overrides.clear()


def _as(client: TestClient, user_id: str) -> TestClient:
    client.cookies.set("ariadna_session", FakeSessionCodec.PREFIX + user_id)
    return client


# --- GET /tickets/mine


def test_ana_lists_her_eight_tickets_newest_first_with_the_four_counters(
    client: TestClient,
) -> None:
    body = _as(client, "ana").get("/api/tickets/mine").json()
    ids = [t["id"] for t in body["tickets"]]
    assert ids == [f"INC{n:07d}" for n in range(1060, 1052, -1)]
    # 1058/1059/1060 are new/new/assigned, 1055/1056 in_progress, 1057 assigned => 6 open.
    assert body["summary"] == {"open": 6, "awaiting": 1, "resolved": 1, "closed": 1}


def test_luis_gets_only_tickets_he_requested_not_the_it_queue(client: TestClient) -> None:
    body = _as(client, "luis").get("/api/tickets/mine").json()
    assert body["tickets"] == []
    assert body["summary"] == {"open": 0, "awaiting": 0, "resolved": 0, "closed": 0}


def test_list_row_has_label_status_and_never_the_requester_id(client: TestClient) -> None:
    row = _as(client, "ana").get("/api/tickets/mine").json()["tickets"][4]
    assert row["id"] == "INC0001056"
    assert row["status"] == "in_progress"
    assert row["awaiting_user"] is True
    assert row["service"] == "network"
    assert row["service_label"] == "Red e internet"
    assert "requester_id" not in row
    assert "assignee_id" not in row


def test_unknown_service_gets_the_fallback_label_not_an_error() -> None:
    odd = replace(TICKETS[0], service="unknown-x")
    try:
        client = _as(_client(InMemoryTicketRepository(tickets=[odd])), "ana")
        row = client.get("/api/tickets/mine").json()["tickets"][0]
        assert row["service"] == "unknown-x"
        assert row["service_label"] == "Otra cosa"
        assert client.get("/api/tickets/INC0001053").status_code == 200
    finally:
        app.dependency_overrides.clear()


def test_list_and_detail_require_a_session(client: TestClient) -> None:
    assert client.get("/api/tickets/mine").status_code == 401
    assert client.get("/api/tickets/INC0001056").status_code == 401


# --- GET /tickets/{display_id}


def test_owner_gets_the_detail_with_awaiting_flag_and_names(client: TestClient) -> None:
    response = _as(client, "ana").get("/api/tickets/INC0001056")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "INC0001056"
    assert body["awaiting_user"] is True
    assert body["description"].startswith("Las paginas tardan")
    assert body["assignee_name"] == "Luis Herrera"
    assert body["impact"] == "high"
    assert body["urgency"] == "high"
    assert body["events"] == []
    assert "requester_id" not in body


def test_unassigned_ticket_has_a_null_assignee_name(client: TestClient) -> None:
    body = _as(client, "ana").get("/api/tickets/INC0001058").json()
    assert body["assignee_name"] is None


def test_foreign_ticket_is_404_for_supervisor_and_it_alike(client: TestClient) -> None:
    for user_id in ("sara", "luis"):
        response = _as(client, user_id).get("/api/tickets/INC0001056")
        assert response.status_code == 404


def test_unknown_and_malformed_ids_are_404_with_the_same_body(client: TestClient) -> None:
    _as(client, "ana")
    unknown = client.get("/api/tickets/INC0009999")
    malformed = client.get("/api/tickets/not-an-id")
    assert unknown.status_code == malformed.status_code == 404
    assert unknown.json() == malformed.json()


# --- detail: events, contact notice, receipt


def _seeded_client() -> TestClient:
    return _client(InMemoryTicketRepository(events=EVENTS, receipts=RECEIPTS))


def test_detail_lists_the_events_oldest_first_and_surfaces_the_contact_message() -> None:
    try:
        client = _as(_seeded_client(), "ana")
        body = client.get("/api/tickets/INC0001056").json()
        assert [e["kind"] for e in body["events"]] == ["created", "assigned", "contact_requested"]
        assert body["events"][2]["body"] == (
            "Confirma desde qué equipos de la sala de captura se ve lenta la red."
        )
        assert body["contact_notice"] == body["events"][2]["body"]
        assert client.get("/api/tickets/INC0001060").json()["contact_notice"] is None
    finally:
        app.dependency_overrides.clear()


def test_detail_exposes_the_stored_receipt_only_for_ariadna_tickets() -> None:
    try:
        client = _as(_seeded_client(), "ana")
        receipt = client.get("/api/tickets/INC0001059").json()["receipt"]
        assert receipt["target_group"] == "Soporte de software"
        assert receipt["permissions_notice"].startswith("Instalar programas")
        assert receipt["missing_data"] == ["Autorización del jefe o encargado"]
        assert client.get("/api/tickets/INC0001058").json()["receipt"] is None
    finally:
        app.dependency_overrides.clear()


def test_events_hidden_from_the_requester_are_not_returned() -> None:
    internal = replace(
        EVENTS[0], id="1056-9", kind="note", ticket_number=1056, visible_to_requester=False
    )
    try:
        client = _as(_client(InMemoryTicketRepository(events=[*EVENTS, internal])), "ana")
        ids = [e["id"] for e in client.get("/api/tickets/INC0001056").json()["events"]]
        assert "1056-9" not in ids
        assert ids == ["1056-1", "1056-2", "1056-3"]
    finally:
        app.dependency_overrides.clear()
