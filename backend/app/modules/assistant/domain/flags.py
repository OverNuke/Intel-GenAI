"""Flags the domain computes from the draft (REQ-AC-3). Never trusted from model output.

Blocking flags answer "can this be sent?" and are a pure function of the draft. The model may only
add warnings; any blocking flag it sends is dropped and replaced by the computed ones.
"""

import re
from typing import Protocol

from app.modules.assistant.domain.proposal import Flag, missing_data_from
from app.modules.assistant.domain.turn import MAX_FLAGS, MAX_ITEMS, AssistantTurn, ToolStep
from app.modules.catalog.domain.services import get_service
from app.modules.tickets.domain.ticket import Impact, Urgency


class DraftLike(Protocol):
    """Both the conversation `Draft` and the turn's `TurnDraft` fit."""

    @property
    def service(self) -> str | None: ...
    @property
    def summary(self) -> str: ...
    @property
    def description(self) -> str: ...
    @property
    def impact(self) -> Impact | None: ...
    @property
    def urgency(self) -> Urgency | None: ...


# Order is the order the assistant asks in.
_REQUIRED: tuple[tuple[str, str], ...] = (
    ("description", "Falta contar qué está pasando."),
    ("service", "Falta elegir con qué servicio se relaciona."),
    ("summary", "Falta un resumen corto de la solicitud."),
    ("impact", "Falta indicar a cuántas personas afecta."),
    ("urgency", "Falta indicar qué tan urgente es."),
)

_ASSET_NUMBER = re.compile(r"\bAT-\d+", re.IGNORECASE)
# Services whose `have_at_hand` item is something the text can be checked for.
_CHECKABLE: dict[str, tuple[str, re.Pattern[str]]] = {"hardware": ("asset_number", _ASSET_NUMBER)}


def missing_required(draft: DraftLike) -> list[Flag]:
    """One blocking flag per required field that is empty or None."""
    absent = {
        "description": not draft.description.strip(),
        "service": not (draft.service or "").strip(),
        "summary": not draft.summary.strip(),
        "impact": draft.impact is None,
        "urgency": draft.urgency is None,
    }
    return [
        Flag(field=field, severity="blocking", message=message)
        for field, message in _REQUIRED
        if absent[field]
    ]


def recommended_warnings(draft: DraftLike) -> list[Flag]:
    """Warnings from the service's `have_at_hand` when the text visibly lacks it."""
    service = get_service(draft.service) if draft.service else None
    check = _CHECKABLE.get(service.key) if service else None
    if service is None or check is None or not service.have_at_hand:
        return []
    field, pattern = check
    if pattern.search(f"{draft.summary} {draft.description}"):
        return []
    return [
        Flag(
            field=field,
            severity="warning",
            message=service.have_at_hand[0][:200],
        )
    ]


def enforce_domain_flags(turn: AssistantTurn) -> AssistantTurn:
    """The turn with domain-owned flags: computed blocking, model warnings, domain warnings.

    Also derives `missing_data` from the blocking flags and clears `ready` while any exist.
    """
    blocking = missing_required(turn.draft)
    seen = {(f.field, f.message) for f in blocking}
    warnings: list[Flag] = []
    for flag in [*turn.flags, *recommended_warnings(turn.draft)]:
        key = (flag.field, flag.message)
        if flag.severity == "blocking" or key in seen:
            continue
        seen.add(key)
        warnings.append(flag)
    flags = [*blocking, *warnings][:MAX_FLAGS]
    return turn.model_copy(
        update={
            "flags": flags,
            "missing_data": missing_data_from(flags),
            "ready": turn.ready and not blocking,
        }
    )


def attach_steps(turn: AssistantTurn, steps: list[ToolStep]) -> AssistantTurn:
    """The turn with its tool trail; `reviewed` then lists only what the tools actually checked."""
    if not steps:
        return turn
    reviewed = [step.summary for step in steps if step.ok][:MAX_ITEMS]
    return turn.model_copy(update={"steps": list(steps), "reviewed": reviewed})
