"""Action proposals and flags are pure value objects: the agent proposes, the human confirms."""

import typing
from collections.abc import Callable

import pytest
from pydantic import TypeAdapter, ValidationError

from app.modules.assistant.domain import proposal
from app.modules.assistant.domain.proposal import (
    ActionProposal,
    AddParticipants,
    CloseTicket,
    CreateTicket,
    Flag,
    UpdateTicket,
)
from app.modules.assistant.domain.turn import AssistantTurn

PROPOSALS: TypeAdapter[ActionProposal] = TypeAdapter(ActionProposal)


def _turn(**changes: object) -> AssistantTurn:
    base: dict[str, object] = {"message": "Revisé tu solicitud."}
    return AssistantTurn.model_validate({**base, **changes})


# --- Flag


def test_flag_has_field_severity_and_message() -> None:
    flag = Flag(field="impact", severity="blocking", message="Falta el impacto.")
    assert (flag.field, flag.severity, flag.message) == ("impact", "blocking", "Falta el impacto.")


def test_flag_severity_is_blocking_or_warning_only() -> None:
    with pytest.raises(ValidationError):
        Flag(field="impact", severity="info", message="x")  # type: ignore[arg-type]


def test_flag_message_is_bounded_to_200_chars() -> None:
    Flag(field="impact", severity="warning", message="x" * 200)
    with pytest.raises(ValidationError):
        Flag(field="impact", severity="warning", message="x" * 201)


def test_flag_is_frozen() -> None:
    flag = Flag(field="impact", severity="warning", message="x")
    with pytest.raises(ValidationError):
        flag.message = "y"


# --- ActionProposal discriminated union


def test_union_discriminates_on_kind() -> None:
    parsed = [
        PROPOSALS.validate_python({"kind": "create_ticket"}),
        PROPOSALS.validate_python({"kind": "add_participants", "names": ["Ana Ruiz"]}),
        PROPOSALS.validate_python(
            {"kind": "update_ticket", "ticket_ref": "INC0001056", "urgency": "high"}
        ),
        PROPOSALS.validate_python({"kind": "close_ticket", "ticket_ref": "INC0001056"}),
    ]
    assert [type(p) for p in parsed] == [CreateTicket, AddParticipants, UpdateTicket, CloseTicket]


def test_unknown_kind_is_rejected() -> None:
    with pytest.raises(ValidationError):
        PROPOSALS.validate_python({"kind": "delete_everything"})


def test_participants_are_display_names_bounded_to_8() -> None:
    names = [f"Persona {i}" for i in range(8)]
    assert AddParticipants(names=names).names == names
    with pytest.raises(ValidationError):
        AddParticipants(names=[*names, "Persona 9"])
    with pytest.raises(ValidationError):
        AddParticipants(names=[])
    with pytest.raises(ValidationError):
        AddParticipants(names=["  "])


def test_update_ticket_needs_at_least_one_changed_field() -> None:
    with pytest.raises(ValidationError):
        UpdateTicket(ticket_ref="INC0001056")
    changed = UpdateTicket(ticket_ref="INC0001056", summary="Nuevo resumen", impact="high")
    assert changed.impact == "high"
    assert changed.description is None


def test_update_ticket_rejects_fields_outside_the_editable_set() -> None:
    with pytest.raises(ValidationError):
        PROPOSALS.validate_python(
            {"kind": "update_ticket", "ticket_ref": "INC0001056", "status": "closed"}
        )


def test_proposals_are_frozen_and_carry_no_callable() -> None:
    parsed = AddParticipants(names=["Ana Ruiz"])
    with pytest.raises(ValidationError):
        parsed.names = []
    for model in (CreateTicket, AddParticipants, UpdateTicket, CloseTicket, Flag):
        for field in model.model_fields.values():
            assert not _mentions_callable(field.annotation), (model, field)
    dumped = PROPOSALS.dump_python(parsed)
    assert not any(callable(value) for value in dumped.values())


def _mentions_callable(annotation: object) -> bool:
    if annotation is Callable or typing.get_origin(annotation) is Callable:
        return True
    return any(_mentions_callable(arg) for arg in typing.get_args(annotation))


def test_proposal_module_exposes_no_id_resolution_or_write_capability() -> None:
    assert not hasattr(proposal, "user_id")
    for model in (CreateTicket, AddParticipants, UpdateTicket, CloseTicket):
        assert not {"user_id", "user_ids", "requester_id", "email"} & set(model.model_fields)


# --- AssistantTurn bounds


def test_turn_defaults_to_no_flags_and_no_proposals() -> None:
    turn = _turn()
    assert turn.flags == []
    assert turn.proposals == []


def test_turn_accepts_up_to_8_flags_and_4_proposals() -> None:
    flags = [{"field": "impact", "severity": "warning", "message": "m"}] * 8
    proposals = [{"kind": "create_ticket"}] * 4
    turn = _turn(flags=flags, proposals=proposals)
    assert len(turn.flags) == 8
    assert len(turn.proposals) == 4


def test_turn_rejects_9_flags_or_5_proposals() -> None:
    flag = {"field": "impact", "severity": "warning", "message": "m"}
    with pytest.raises(ValidationError):
        _turn(flags=[flag] * 9)
    with pytest.raises(ValidationError):
        _turn(proposals=[{"kind": "create_ticket"}] * 5)


def test_missing_data_is_derived_from_blocking_flags_when_not_given() -> None:
    turn = _turn(
        flags=[
            {"field": "impact", "severity": "blocking", "message": "Falta el impacto."},
            {"field": "asset_number", "severity": "warning", "message": "Sin inventario."},
        ]
    )
    assert turn.missing_data == ["Impacto"]
