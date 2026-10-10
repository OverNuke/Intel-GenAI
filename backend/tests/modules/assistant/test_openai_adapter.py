"""OpenAI-compatible adapter against httpx.MockTransport: no network, no prose assertions."""

import json
from collections.abc import Callable
from typing import Any

import httpx
import pytest

from app.modules.assistant.domain.conversation import Conversation, Draft, Entry, Message
from app.modules.assistant.domain.errors import AssistantUnavailable
from app.modules.assistant.infrastructure.openai_adapter import OpenAICompatibleAssistant

VALID_TURN = {
    "message": "¿Desde cuándo te pasa?",
    "understood": "La VPN no conecta desde casa.",
    "reviewed": ["Destino sugerido: Soporte de redes"],
    "draft": {
        "service": "network",
        "summary": "VPN no conecta",
        "description": "La VPN no conecta desde casa",
        "impact": None,
        "urgency": None,
    },
    "missing_data": ["Impacto"],
    "target_group": "Soporte de redes",
    "needs_authorization": False,
    "permissions_notice": None,
    "ready": False,
}


def _completion(content: str) -> dict[str, Any]:
    return {
        "id": "chatcmpl-1",
        "object": "chat.completion",
        "created": 0,
        "model": "test-model",
        "choices": [
            {
                "index": 0,
                "finish_reason": "stop",
                "message": {"role": "assistant", "content": content},
            }
        ],
    }


class Script:
    """Replays queued handlers and records every outbound request."""

    def __init__(self, *steps: Callable[[httpx.Request], httpx.Response]) -> None:
        self._steps = list(steps)
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        step = self._steps.pop(0) if len(self._steps) > 1 else self._steps[0]
        return step(request)

    @property
    def calls(self) -> int:
        return len(self.requests)


def ok(payload: dict[str, Any] | str = VALID_TURN) -> Callable[[httpx.Request], httpx.Response]:
    content = payload if isinstance(payload, str) else json.dumps(payload)
    return lambda _: httpx.Response(200, json=_completion(content))


def status(code: int) -> Callable[[httpx.Request], httpx.Response]:
    return lambda _: httpx.Response(code, json={"error": {"message": "nope"}})


def raises(error: Exception) -> Callable[[httpx.Request], httpx.Response]:
    def handler(request: httpx.Request) -> httpx.Response:
        raise error

    return handler


def _adapter(script: Script) -> OpenAICompatibleAssistant:
    client = httpx.AsyncClient(transport=httpx.MockTransport(script))
    return OpenAICompatibleAssistant(
        base_url="https://llm.example/v1",
        model="test-model",
        api_key="sk-test",
        timeout_seconds=5,
        http_client=client,
    )


CONVERSATION = Conversation(
    entry=Entry("service", "network"),
    history=(Message("user", "No conecta la VPN desde casa"),),
    draft=Draft(service="network", summary="VPN caída", description="No conecta"),
)


async def test_valid_output_is_returned_as_a_turn() -> None:
    script = Script(ok())
    turn = await _adapter(script).next_turn(CONVERSATION)
    assert turn.draft.service == "network"
    assert turn.ready is False
    assert script.calls == 1


async def test_markdown_fenced_json_is_accepted() -> None:
    fenced = "```json\n" + json.dumps(VALID_TURN) + "\n```"
    turn = await _adapter(Script(ok(fenced))).next_turn(CONVERSATION)
    assert turn.target_group == "Soporte de redes"


async def test_invalid_then_valid_retries_once_and_returns_the_turn() -> None:
    """S-AC-3"""
    script = Script(ok("not json at all"), ok())
    turn = await _adapter(script).next_turn(CONVERSATION)
    assert turn.draft.summary == "VPN no conecta"
    assert script.calls == 2


async def test_schema_violation_counts_as_invalid_output() -> None:
    two_questions = {**VALID_TURN, "message": "¿Desde cuándo? ¿Qué mensaje ves?"}
    script = Script(ok(two_questions), ok())
    turn = await _adapter(script).next_turn(CONVERSATION)
    assert turn.message == "¿Desde cuándo te pasa?"
    assert script.calls == 2


async def test_invalid_twice_degrades_with_invalid_output() -> None:
    """S-AC-4"""
    script = Script(ok("nope"), ok("still nope"))
    with pytest.raises(AssistantUnavailable) as caught:
        await _adapter(script).next_turn(CONVERSATION)
    assert caught.value.reason == "invalid_output"
    assert script.calls == 2


async def test_rate_limit_degrades_immediately_without_retry() -> None:
    """S-AC-5"""
    script = Script(status(429), ok())
    with pytest.raises(AssistantUnavailable) as caught:
        await _adapter(script).next_turn(CONVERSATION)
    assert caught.value.reason == "rate_limited"
    assert script.calls == 1


async def test_timeout_degrades() -> None:
    """S-AC-6"""
    script = Script(raises(httpx.ReadTimeout("slow")))
    with pytest.raises(AssistantUnavailable) as caught:
        await _adapter(script).next_turn(CONVERSATION)
    assert caught.value.reason == "timeout"
    assert script.calls == 1


async def test_connection_error_degrades() -> None:
    script = Script(raises(httpx.ConnectError("down")))
    with pytest.raises(AssistantUnavailable) as caught:
        await _adapter(script).next_turn(CONVERSATION)
    assert caught.value.reason == "connection_error"
    assert script.calls == 1


@pytest.mark.parametrize("code", [400, 401, 500, 503])
async def test_other_http_errors_degrade_without_retry(code: int) -> None:
    script = Script(status(code), ok())
    with pytest.raises(AssistantUnavailable) as caught:
        await _adapter(script).next_turn(CONVERSATION)
    assert caught.value.reason == "http_error"
    assert script.calls == 1


async def test_outbound_payload_has_context_and_no_identity() -> None:
    """S-AC-9: conversation, entry context and draft only; no email, user id or other users."""
    script = Script(ok())
    conv = Conversation(
        entry=Entry("ticket", "INC0001056"),
        history=(Message("user", "No conecta la VPN"), Message("assistant", "¿Desde cuándo?")),
        draft=Draft(service="network", summary="VPN caída", description="No conecta"),
        ticket_summary="Red lenta en toda el area de captura",
        ticket_status="in_progress",
    )
    await _adapter(script).next_turn(conv)
    request = script.requests[0]
    body = request.content.decode("utf8")
    payload = json.loads(body)
    assert payload["model"] == "test-model"
    assert request.headers["authorization"] == "Bearer sk-test"
    assert str(request.url) == "https://llm.example/v1/chat/completions"
    for fragment in ("VPN caída", "Red lenta en toda el area de captura", "in_progress"):
        assert fragment in body
    # ("email" alone is also a catalog service key, so only the JSON-key form is forbidden.)
    for forbidden in ("@ejemplo.mx", "ana.ruiz", "requester", "user_id", '\\"email\\"'):
        assert forbidden not in body


async def test_client_is_built_without_sdk_retries() -> None:
    adapter = _adapter(Script(ok()))
    assert adapter.max_retries == 0
