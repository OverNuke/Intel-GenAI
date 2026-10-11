from dataclasses import fields

import pytest
from pydantic import ValidationError

from app.modules.assistant.domain.conversation import (
    MAX_HISTORY,
    MAX_MESSAGE_CHARS,
    Conversation,
    ConversationLimitError,
    Draft,
    Entry,
    Message,
)
from app.modules.assistant.domain.errors import AssistantUnavailable, Handoff
from app.modules.assistant.domain.turn import AssistantTurn, TurnDraft


def _turn(**changes: object) -> AssistantTurn:
    base: dict[str, object] = {
        "message": "¿Desde cuándo te pasa?",
        "understood": "La impresora no imprime.",
        "reviewed": ["Destino sugerido: Soporte de impresión"],
        "draft": TurnDraft(
            service="printing",
            summary="Impresora",
            description="No imprime",
            impact=None,
            urgency=None,
        ),
        "missing_data": ["Impacto"],
        "target_group": "Soporte de impresión",
        "needs_authorization": False,
        "permissions_notice": None,
        "ready": False,
    }
    return AssistantTurn.model_validate({**base, **changes})


# --- Conversation limits and privacy (REQ-AC-8, REQ-AC-11)


def test_conversation_accepts_history_up_to_the_limits() -> None:
    history = tuple(Message("user", "x" * MAX_MESSAGE_CHARS) for _ in range(MAX_HISTORY))
    conversation = Conversation(entry=Entry("new"), history=history)
    assert len(conversation.history) == 20


def test_conversation_rejects_too_many_messages() -> None:
    history = tuple(Message("user", "hola") for _ in range(MAX_HISTORY + 1))
    with pytest.raises(ConversationLimitError):
        Conversation(entry=Entry("new"), history=history)


def test_conversation_rejects_an_over_long_message() -> None:
    with pytest.raises(ConversationLimitError):
        Conversation(
            entry=Entry("new"), history=(Message("user", "x" * (MAX_MESSAGE_CHARS + 1)),)
        )


def test_conversation_carries_no_person_identifying_field() -> None:
    names = {f.name for f in fields(Conversation)} | {f.name for f in fields(Draft)}
    assert names.isdisjoint({"user_id", "requester_id", "email", "name", "display_name"})
    assert {f.name for f in fields(Entry)} == {"kind", "ref"}


# --- AssistantTurn invariants (REQ-AC-2, REQ-AC-3)


def test_a_turn_with_one_question_is_valid() -> None:
    assert _turn().message == "¿Desde cuándo te pasa?"


def test_a_turn_with_two_questions_is_rejected() -> None:
    with pytest.raises(ValidationError):
        _turn(message="¿Desde cuándo te pasa? ¿Aparece algún mensaje?")


def test_a_ready_statement_without_question_is_valid() -> None:
    turn = _turn(message="Revisé tu solicitud. Tú decides.", ready=True, missing_data=[])
    assert turn.ready is True


def test_message_over_600_chars_or_empty_is_rejected() -> None:
    with pytest.raises(ValidationError):
        _turn(message="a" * 601)
    with pytest.raises(ValidationError):
        _turn(message="   ")


def test_turn_has_no_submit_or_identity_fields() -> None:
    names = set(AssistantTurn.model_fields)
    assert names == {
        "message",
        "understood",
        "reviewed",
        "draft",
        "missing_data",
        "flags",
        "proposals",
        "steps",
        "target_group",
        "needs_authorization",
        "permissions_notice",
        "ready",
    }


# --- Errors


def test_unavailable_carries_its_reason_and_handoff_keeps_the_draft() -> None:
    error = AssistantUnavailable("rate_limited")
    assert error.reason == "rate_limited"
    draft = Draft(service="network", summary="VPN", description="No conecta")
    handoff = Handoff(reason=error.reason, draft=draft)
    assert handoff.draft.summary == "VPN"
