"""The evidence trail of an agent turn: bounded steps, `reviewed` derived from them."""

import pytest
from pydantic import ValidationError

from app.modules.assistant.domain.flags import attach_steps
from app.modules.assistant.domain.turn import AssistantTurn, ToolStep, TurnDraft


def _turn(**over: object) -> AssistantTurn:
    base: dict[str, object] = {
        "message": "¿Desde cuándo te pasa?",
        "reviewed": ["Lo que dijo el modelo"],
        "draft": TurnDraft(service="network"),
    }
    return AssistantTurn.model_validate({**base, **over})


def test_a_step_summary_is_limited_to_200_characters() -> None:
    ToolStep(name="find_user", summary="x" * 200)
    with pytest.raises(ValidationError):
        ToolStep(name="find_user", summary="x" * 201)


def test_a_turn_carries_at_most_four_steps() -> None:
    steps = [ToolStep(name="search_catalog", summary=f"paso {i}") for i in range(5)]
    with pytest.raises(ValidationError):
        _turn(steps=steps)
    assert len(_turn(steps=steps[:4]).steps) == 4


def test_no_steps_by_default() -> None:
    assert _turn().steps == []


def test_reviewed_is_derived_from_the_successful_steps() -> None:
    steps = [
        ToolStep(name="check_required_data", summary="Datos obligatorios: faltan 2"),
        ToolStep(name="find_similar_tickets", summary="No pude revisar tus solicitudes", ok=False),
        ToolStep(name="find_user", summary="Busqué a «Luis»: Luis Herrera"),
    ]
    turn = attach_steps(_turn(), steps)
    assert turn.steps == steps
    assert turn.reviewed == ["Datos obligatorios: faltan 2", "Busqué a «Luis»: Luis Herrera"]


def test_without_steps_reviewed_is_left_alone() -> None:
    assert attach_steps(_turn(), []).reviewed == ["Lo que dijo el modelo"]
