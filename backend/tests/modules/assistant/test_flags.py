"""Blocking flags are computed by the domain, never accepted from model output."""

from app.modules.assistant.domain.conversation import Draft
from app.modules.assistant.domain.flags import (
    enforce_domain_flags,
    missing_required,
    recommended_warnings,
)
from app.modules.assistant.domain.proposal import Flag
from app.modules.assistant.domain.turn import AssistantTurn, TurnDraft

COMPLETE = Draft(
    service="network",
    summary="VPN caída",
    description="No conecta desde casa",
    impact="medium",
    urgency="low",
)


def _fields(flags: list[Flag]) -> list[str]:
    return [f.field for f in flags]


# --- missing_required


def test_complete_draft_has_no_blocking_flags() -> None:
    assert missing_required(COMPLETE) == []


def test_empty_draft_blocks_on_every_required_field() -> None:
    flags = missing_required(Draft())
    assert set(_fields(flags)) == {"service", "summary", "description", "impact", "urgency"}
    assert {f.severity for f in flags} == {"blocking"}
    assert all(f.message for f in flags)


def test_blank_strings_count_as_empty() -> None:
    draft = Draft(service="network", summary="  ", description="\n", impact="low", urgency="low")
    assert set(_fields(missing_required(draft))) == {"summary", "description"}


def test_only_the_absent_fields_are_flagged() -> None:
    draft = Draft(service="printing", summary="s", description="d", impact=None, urgency="high")
    assert _fields(missing_required(draft)) == ["impact"]


def test_missing_required_accepts_a_turn_draft_too() -> None:
    assert _fields(missing_required(TurnDraft(service="network"))) == [
        "description",
        "summary",
        "impact",
        "urgency",
    ]


# --- recommended_warnings


def test_hardware_without_an_inventory_number_warns() -> None:
    draft = Draft(service="hardware", summary="PC", description="Mi PC no enciende")
    flags = recommended_warnings(draft)
    assert _fields(flags) == ["asset_number"]
    assert flags[0].severity == "warning"
    assert "AT-" in flags[0].message
    # The UI adds its own "Conviene revisar:" prefix; the message must not repeat one.
    assert not flags[0].message.startswith("Conviene")


def test_hardware_with_an_inventory_number_does_not_warn() -> None:
    draft = Draft(service="hardware", summary="PC", description="Equipo AT-004512 no enciende")
    assert recommended_warnings(draft) == []
    lower = Draft(service="hardware", description="equipo at-4512 no enciende")
    assert recommended_warnings(lower) == []


def test_other_services_and_unknown_service_do_not_warn() -> None:
    assert recommended_warnings(Draft(service="network", description="sin vpn")) == []
    assert recommended_warnings(Draft(service=None)) == []
    assert recommended_warnings(Draft(service="nope")) == []


# --- enforce_domain_flags (applied to every LLM turn)


def _turn(**changes: object) -> AssistantTurn:
    base: dict[str, object] = {
        "message": "¿A cuántas personas afecta?",
        "draft": TurnDraft(service="network", summary="VPN", description="No conecta"),
    }
    return AssistantTurn.model_validate({**base, **changes})


def test_model_provided_blocking_flags_are_dropped() -> None:
    turn = _turn(
        flags=[
            {"field": "service", "severity": "blocking", "message": "inventado"},
            {"field": "impact", "severity": "blocking", "message": "mi texto"},
        ]
    )
    result = enforce_domain_flags(turn)
    blocking = [f for f in result.flags if f.severity == "blocking"]
    assert sorted(f.field for f in blocking) == ["impact", "urgency"]
    assert all(f.message not in {"inventado", "mi texto"} for f in blocking)


def test_model_warning_flags_are_kept() -> None:
    turn = _turn(flags=[{"field": "description", "severity": "warning", "message": "Es corta."}])
    result = enforce_domain_flags(turn)
    assert any(f.message == "Es corta." for f in result.flags)


def test_domain_warnings_are_added_and_not_duplicated() -> None:
    draft = TurnDraft(service="hardware", summary="PC", description="No enciende")
    first = enforce_domain_flags(_turn(draft=draft))
    assert _fields([f for f in first.flags if f.severity == "warning"]) == ["asset_number"]
    again = enforce_domain_flags(
        _turn(draft=draft, flags=[f.model_dump() for f in first.flags])
    )
    assert _fields(again.flags).count("asset_number") == 1


def test_model_cannot_make_a_turn_ready_while_blocking_flags_exist() -> None:
    result = enforce_domain_flags(_turn(ready=True, message="Listo."))
    assert result.ready is False


def test_complete_draft_stays_ready_and_missing_data_is_derived() -> None:
    complete = TurnDraft(
        service="network", summary="VPN", description="No conecta", impact="low", urgency="low"
    )
    ready = enforce_domain_flags(_turn(draft=complete, ready=True, message="Listo."))
    assert ready.ready is True
    assert ready.missing_data == []
    partial = enforce_domain_flags(_turn(missing_data=["lo que sea"]))
    assert partial.missing_data == ["Impacto", "Urgencia"]


def test_flags_are_capped_at_8_with_blocking_first() -> None:
    noisy = [{"field": f"f{i}", "severity": "warning", "message": "m"} for i in range(8)]
    result = enforce_domain_flags(_turn(flags=noisy))
    assert len(result.flags) == 8
    assert [f.severity for f in result.flags[:2]] == ["blocking", "blocking"]
