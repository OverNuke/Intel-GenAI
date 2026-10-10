import ast
import inspect
import pathlib

import pytest

from app.modules.assistant.application import ports
from app.modules.assistant.application.converse import converse
from app.modules.assistant.application.ports import AssistantPort
from app.modules.assistant.domain.conversation import Conversation, Draft, Entry, Message
from app.modules.assistant.domain.errors import AssistantUnavailable, Handoff
from app.modules.assistant.domain.turn import AssistantTurn, TurnDraft

ASSISTANT_ROOT = pathlib.Path(ports.__file__).resolve().parents[1]

FORBIDDEN_WORDS = ("submit", "create", "close", "confirm", "send")


def test_port_exposes_only_next_turn() -> None:
    """S-AC-7: the assistant can neither submit, create nor close a ticket."""
    public = {name for name, _ in inspect.getmembers(AssistantPort) if not name.startswith("_")}
    assert public == {"next_turn"}
    assert not any(word in name for name in public for word in FORBIDDEN_WORDS)


def _calls(tree: ast.AST) -> list[tuple[str, str]]:
    """(receiver tail, attribute) of every `x.y.attr(...)` call."""
    found: list[tuple[str, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            receiver = node.func.value
            tail = (
                receiver.attr
                if isinstance(receiver, ast.Attribute)
                else getattr(receiver, "id", "")
            )
            found.append((tail, node.func.attr))
    return found


def test_assistant_module_cannot_reach_ticket_creation() -> None:
    """S-TS-7: no submit use case, no SQL adapter, no create/submit/close call on a repository."""
    sources = list(ASSISTANT_ROOT.rglob("*.py"))
    assert sources
    for path in sources:
        text = path.read_text(encoding="utf8")
        assert "tickets.application.submit" not in text, path
        assert "sqlalchemy_tickets" not in text, path
        assert "submit_ticket" not in text, path
        for receiver, attribute in _calls(ast.parse(text)):
            risky = attribute in {"create", "submit", "close", "request_contact"}
            # The OpenAI SDK's `client.chat.completions.create` is the LLM call, not a ticket.
            assert not risky or receiver == "completions", (path, receiver, attribute)


def test_domain_has_no_framework_imports() -> None:
    for path in (ASSISTANT_ROOT / "domain").rglob("*.py"):
        text = path.read_text(encoding="utf8")
        for banned in ("fastapi", "sqlalchemy", "openai", "httpx"):
            assert f"import {banned}" not in text and f"from {banned}" not in text, path


def _turn() -> AssistantTurn:
    return AssistantTurn(
        message="¿Desde cuándo te pasa?",
        understood="La VPN no conecta.",
        reviewed=[],
        draft=TurnDraft(service="network", summary="VPN", description="No conecta"),
        missing_data=[],
        target_group="Soporte de redes",
        needs_authorization=False,
        permissions_notice=None,
        ready=False,
    )


class _Working:
    async def next_turn(self, conv: Conversation) -> AssistantTurn:
        return _turn()


class _Down:
    def __init__(self, reason: str) -> None:
        self.reason = reason

    async def next_turn(self, conv: Conversation) -> AssistantTurn:
        raise AssistantUnavailable(self.reason)  # type: ignore[arg-type]


CONVERSATION = Conversation(
    entry=Entry("service", "network"),
    history=(Message("user", "No conecta la VPN"),),
    draft=Draft(service="network", summary="VPN caída", description="No conecta desde casa"),
)


async def test_converse_returns_the_turn_when_the_port_answers() -> None:
    result = await converse(_Working(), CONVERSATION)
    assert isinstance(result, AssistantTurn)
    assert result.message == "¿Desde cuándo te pasa?"


@pytest.mark.parametrize("reason", ["rate_limited", "timeout", "invalid_output", "http_error"])
async def test_converse_degrades_to_a_handoff_that_keeps_the_draft(reason: str) -> None:
    result = await converse(_Down(reason), CONVERSATION)
    assert isinstance(result, Handoff)
    assert result.reason == reason
    assert result.draft == CONVERSATION.draft
