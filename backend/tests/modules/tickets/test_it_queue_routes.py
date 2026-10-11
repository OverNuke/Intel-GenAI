"""GET /api/it/tickets (T1): ticket-tracking section, injected clock."""

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.api.deps import get_session_codec, get_user_repository
from app.modules.tickets.api.deps import get_clock, get_ticket_repository
from tests.modules.auth.fakes import FakeSessionCodec, InMemoryUserRepository
from tests.modules.tickets.fakes import InMemoryTicketRepository

NOW = datetime(2026, 1, 14, 10, 0, tzinfo=UTC)


@pytest.fixture
def client() -> Iterator[TestClient]:
    users, codec, repo = InMemoryUserRepository(), FakeSessionCodec(), InMemoryTicketRepository()
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


def test_no_session_is_401(client: TestClient) -> None:
    assert client.get("/api/it/tickets").status_code == 401


@pytest.mark.parametrize("user_id", ["ana", "sara"])
def test_s_it_2_non_it_roles_get_the_denial_payload(client: TestClient, user_id: str) -> None:
    response = _as(client, user_id).get("/api/it/tickets")
    assert response.status_code == 403
    assert response.json() == {
        "allowed": False,
        "section": {"key": "ticket-tracking", "label": "Seguimiento de tickets"},
        "required_role": {"key": "it", "label": "TI"},
    }


def test_s_it_1_luis_sees_all_eight_seeded_tickets_of_any_requester(client: TestClient) -> None:
    body = _as(client, "luis").get("/api/it/tickets").json()
    assert len(body["tickets"]) == 8
    assert {t["requester_name"] for t in body["tickets"]} == {"Ana Ruiz"}
    assert body["summary"] == {"open": 6, "unassigned": 2, "assigned_to_me": 4, "sla_at_risk": 3}


def test_rows_carry_priority_sla_assignee_and_the_ariadna_marker(client: TestClient) -> None:
    rows = {t["id"]: t for t in _as(client, "luis").get("/api/it/tickets").json()["tickets"]}
    critical = rows["INC0001056"]
    assert critical["priority"] == "critical"
    assert critical["sla_state"] == "overdue"
    assert critical["sla_due_at"] == "2026-01-08T15:00:00Z"
    assert critical["assignee_name"] == "Luis Herrera"
    assert critical["assigned_to_me"] is True
    assert critical["awaiting_user"] is True
    assert rows["INC0001058"]["assignee_name"] is None
    assert rows["INC0001058"]["assigned_to_me"] is False


def test_s_it_7_via_ariadna_marks_1055_1057_1059_only(client: TestClient) -> None:
    rows = _as(client, "luis").get("/api/it/tickets").json()["tickets"]
    marked = sorted(t["id"] for t in rows if t["via_ariadna"])
    assert marked == ["INC0001055", "INC0001057", "INC0001059"]


def test_assigned_to_me_is_relative_to_the_session_user(client: TestClient) -> None:
    rows = _as(client, "luis").get("/api/it/tickets").json()["tickets"]
    mine = sorted(t["id"] for t in rows if t["assigned_to_me"])
    # Closed/resolved ones included: 1053, 1054, 1055, 1056, 1057, 1060.
    assert mine == [
        "INC0001053",
        "INC0001054",
        "INC0001055",
        "INC0001056",
        "INC0001057",
        "INC0001060",
    ]


def test_unassigned_tickets_are_exactly_1058_and_1059(client: TestClient) -> None:
    rows = _as(client, "luis").get("/api/it/tickets").json()["tickets"]
    unassigned = sorted(t["id"] for t in rows if t["assignee_name"] is None)
    assert unassigned == ["INC0001058", "INC0001059"]
