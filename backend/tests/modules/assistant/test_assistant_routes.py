"""POST /api/assistant/turn: stateless, authenticated, never 5xx for LLM failures."""

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.assistant.api.deps import get_assistant, get_ticket_lookup
from app.modules.assistant.domain.conversation import Conversation
from app.modules.assistant.domain.errors import AssistantUnavailable
from app.modules.assistant.domain.turn import AssistantTurn
from app.modules.assistant.infrastructure.fake import FakeAssistant
from app.modules.auth.api.deps import get_session_codec, get_user_repository
from tests.modules.auth.fakes import FakeSessionCodec, InMemoryUserRepository
from tests.modules.tickets.fakes import InMemoryTicketRepository


class Spy:
    """Records what the route handed to the port."""

    def __init__(self) -> None:
        self.seen: list[Conversation] = []
        self._fake = FakeAssistant()

    async def next_turn(self, conv: Conversation) -> AssistantTurn:
        self.seen.append(conv)
        return await self._fake.next_turn(conv)


class Down:
    async def next_turn(self, conv: Conversation) -> AssistantTurn:
        raise AssistantUnavailable("rate_limited")


@pytest.fixture
def spy() -> Spy:
    return Spy()


@pytest.fixture
def client(spy: Spy) -> Iterator[TestClient]:
    users, codec = InMemoryUserRepository(), FakeSessionCodec()
    tickets = InMemoryTicketRepository()
    app.dependency_overrides[get_user_repository] = lambda: users
    app.dependency_overrides[get_session_codec] = lambda: codec
    app.dependency_overrides[get_assistant] = lambda: spy
    app.dependency_overrides[get_ticket_lookup] = lambda: tickets
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _as(client: TestClient, user_id: str) -> TestClient:
    client.cookies.set("ariadna_session", FakeSessionCodec.PREFIX + user_id)
    return client


def _body(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "entry": {"kind": "new"},
        "history": [{"role": "user", "content": "La impresora del piso 2 no imprime"}],
        "draft": {},
    }
    return {**base, **over}


def test_requires_a_session(client: TestClient) -> None:
    assert client.post("/api/assistant/turn", json=_body()).status_code == 401


def test_new_entry_returns_a_validated_turn(client: TestClient) -> None:
    response = _as(client, "ana").post("/api/assistant/turn", json=_body())
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "turn"
    assert body["turn"]["draft"]["service"] == "printing"
    assert body["turn"]["message"].count("?") <= 1


def test_every_role_may_use_the_assistant(client: TestClient) -> None:
    for user_id in ("ana", "luis", "sara"):
        assert _as(client, user_id).post("/api/assistant/turn", json=_body()).status_code == 200


def test_unavailable_assistant_answers_200_with_a_handoff_keeping_the_draft(
    client: TestClient,
) -> None:
    app.dependency_overrides[get_assistant] = lambda: Down()
    draft = {"service": "network", "summary": "VPN caída", "description": "No conecta"}
    response = _as(client, "ana").post("/api/assistant/turn", json=_body(draft=draft))
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "handoff"
    assert body["reason"] == "rate_limited"
    assert body["draft"]["summary"] == "VPN caída"


def test_ticket_entry_must_be_owned_by_the_session_user(client: TestClient) -> None:
    owned = _as(client, "ana").post(
        "/api/assistant/turn", json=_body(entry={"kind": "ticket", "ref": "INC0001056"})
    )
    assert owned.status_code == 200
    foreign = _as(client, "sara").post(
        "/api/assistant/turn", json=_body(entry={"kind": "ticket", "ref": "INC0001056"})
    )
    assert foreign.status_code == 404
    # IT does not get a bypass either (REQ-AC-10: owned by the session user).
    assert (
        _as(client, "luis")
        .post("/api/assistant/turn", json=_body(entry={"kind": "ticket", "ref": "INC0001056"}))
        .status_code
        == 404
    )


def test_ticket_entry_sends_only_summary_and_status_context(
    client: TestClient, spy: Spy
) -> None:
    _as(client, "ana").post(
        "/api/assistant/turn", json=_body(entry={"kind": "ticket", "ref": "INC0001056"})
    )
    conv = spy.seen[-1]
    assert conv.ticket_summary == "Red lenta en toda el area de captura"
    assert conv.ticket_status == "in_progress"
    assert not hasattr(conv, "user_id")


def test_unknown_or_malformed_ticket_ref_is_404_and_missing_ref_is_422(
    client: TestClient,
) -> None:
    _as(client, "ana")
    for ref in ("INC0009999", "garbage"):
        response = client.post(
            "/api/assistant/turn", json=_body(entry={"kind": "ticket", "ref": ref})
        )
        assert response.status_code == 404
    missing = client.post("/api/assistant/turn", json=_body(entry={"kind": "ticket"}))
    assert missing.status_code == 422


def test_unknown_service_entry_is_422_and_known_one_is_accepted(client: TestClient) -> None:
    _as(client, "ana")
    bad = client.post(
        "/api/assistant/turn", json=_body(entry={"kind": "service", "ref": "unknown-x"})
    )
    assert bad.status_code == 422
    good = client.post(
        "/api/assistant/turn", json=_body(entry={"kind": "service", "ref": "network"})
    )
    assert good.status_code == 200
    assert good.json()["turn"]["draft"]["service"] == "network"


def test_over_limit_input_is_422(client: TestClient) -> None:
    _as(client, "ana")
    too_many = [{"role": "user", "content": "hola"}] * 21
    assert client.post("/api/assistant/turn", json=_body(history=too_many)).status_code == 422
    too_long = [{"role": "user", "content": "x" * 2001}]
    assert client.post("/api/assistant/turn", json=_body(history=too_long)).status_code == 422


def test_identity_fields_in_the_body_are_rejected(client: TestClient) -> None:
    _as(client, "ana")
    response = client.post(
        "/api/assistant/turn", json=_body(requester_id="luis", email="luis.herrera@ejemplo.mx")
    )
    assert response.status_code == 422
