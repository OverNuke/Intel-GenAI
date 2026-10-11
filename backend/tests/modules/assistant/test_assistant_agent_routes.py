"""POST /api/assistant/turn in agent mode: tools are bound to the session user, server-side."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.assistant.api.deps import (
    get_assistant,
    get_requester_tickets,
    get_ticket_lookup,
    get_user_lookup,
)
from app.modules.assistant.infrastructure.fake import FakeAssistant
from app.modules.assistant.infrastructure.user_lookup import AccountUserLookup
from app.modules.auth.api.deps import get_session_codec, get_user_repository
from tests.modules.auth.fakes import FakeSessionCodec, InMemoryUserRepository
from tests.modules.tickets.fakes import InMemoryTicketRepository


@pytest.fixture
def client() -> Iterator[TestClient]:
    users, codec, tickets = InMemoryUserRepository(), FakeSessionCodec(), InMemoryTicketRepository()
    app.dependency_overrides[get_user_repository] = lambda: users
    app.dependency_overrides[get_session_codec] = lambda: codec
    app.dependency_overrides[get_assistant] = lambda: FakeAssistant(mode="agent")
    app.dependency_overrides[get_ticket_lookup] = lambda: tickets
    app.dependency_overrides[get_requester_tickets] = lambda: tickets
    app.dependency_overrides[get_user_lookup] = lambda: AccountUserLookup(users)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _turn(client: TestClient, user_id: str, *messages: str) -> dict[str, object]:
    client.cookies.set("ariadna_session", FakeSessionCodec.PREFIX + user_id)
    body = {
        "entry": {"kind": "new"},
        "history": [{"role": "user", "content": m} for m in messages],
        "draft": {},
    }
    response = client.post("/api/assistant/turn", json=body)
    assert response.status_code == 200
    result: dict[str, object] = response.json()
    return result


def test_the_trail_is_exposed_and_reviewed_is_derived_from_it(client: TestClient) -> None:
    body = _turn(client, "ana", "La red está lenta en toda mi area")
    turn = body["turn"]
    assert isinstance(turn, dict)
    steps = turn["steps"]
    assert steps[0]["name"] == "check_required_data"
    assert turn["reviewed"] == [s["summary"] for s in steps if s["ok"]]


def test_similar_tickets_come_from_the_session_users_own_tickets(client: TestClient) -> None:
    ana = _turn(client, "ana", "La red está lenta en toda mi area")["turn"]
    sara = _turn(client, "sara", "La red está lenta en toda mi area")["turn"]
    assert isinstance(ana, dict) and isinstance(sara, dict)
    ana_similar = next(s for s in ana["steps"] if s["name"] == "find_similar_tickets")
    sara_similar = next(s for s in sara["steps"] if s["name"] == "find_similar_tickets")
    assert "INC0001056" in ana_similar["summary"]
    assert "INC0001056" not in sara_similar["summary"]


def test_adding_people_returns_a_proposal_with_display_names_only(client: TestClient) -> None:
    body = _turn(client, "ana", "No conecta la VPN", "agrega a Luis y a Sara")
    turn = body["turn"]
    assert isinstance(turn, dict)
    [proposal] = turn["proposals"]
    assert proposal["kind"] == "add_participants"
    assert proposal["names"] == ["Luis Herrera", "Sara Molina"]
    assert "@" not in str(turn)


def test_the_requester_is_excluded_from_user_lookups(client: TestClient) -> None:
    body = _turn(client, "ana", "No conecta la VPN", "agrega a Ana")
    turn = body["turn"]
    assert isinstance(turn, dict)
    assert turn["proposals"] == []
