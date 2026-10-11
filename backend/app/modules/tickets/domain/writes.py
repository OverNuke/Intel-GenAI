"""Rules of the writes a person confirms after Ariadna proposed them (ADR-0003 amendment).

Every write needs a human confirmation built server-side from the session. Participants and
updates belong to the requester; closing belongs to the requester or IT, once Resuelto.
"""

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Literal

from app.modules.auth.domain.user import Role, User
from app.modules.tickets.domain.ticket import Ticket

MAX_PARTICIPANTS = 8
MAX_SUMMARY = 200
MAX_DESCRIPTION = 4000
UPDATABLE_FIELDS: tuple[str, ...] = ("summary", "description", "impact", "urgency")
_LEVELS = frozenset({"high", "medium", "low"})


@dataclass(frozen=True)
class WriteConfirmation:
    """Who confirmed. The assistant may never be `human`: Ariadna proposes, the person confirms."""

    by: Literal["human", "assistant"]
    actor_id: str
    actor_role: Role


RequesterWriteRefusal = Literal[
    "missing-human-confirmation", "confirmation-not-from-requester", "ticket-closed"
]
UpdateRefusal = RequesterWriteRefusal | Literal["no-changes", "unknown-field", "invalid-value"]
CloseRefusal = Literal[
    "missing-human-confirmation", "not-allowed", "not-resolved", "already-closed"
]


def _requester_write(
    ticket: Ticket, confirmation: WriteConfirmation | None
) -> RequesterWriteRefusal | None:
    if confirmation is None or confirmation.by != "human":
        return "missing-human-confirmation"
    if confirmation.actor_id != ticket.requester_id:
        return "confirmation-not-from-requester"
    if ticket.status == "closed":
        return "ticket-closed"
    return None


# --- participants


def check_participants_write(
    ticket: Ticket, confirmation: WriteConfirmation | None
) -> RequesterWriteRefusal | None:
    return _requester_write(ticket, confirmation)


@dataclass(frozen=True)
class AmbiguousName:
    name: str
    candidates: tuple[str, ...]  # display names, so the person can type a fuller one


@dataclass(frozen=True)
class ParticipantsPlan:
    to_add: tuple[User, ...]
    ambiguous: tuple[AmbiguousName, ...]
    unknown: tuple[str, ...]
    over_limit: tuple[User, ...]


def plan_participants(
    *,
    requester_id: str,
    assignee_id: str | None,
    current: Sequence[str],
    resolved: Sequence[tuple[str, Sequence[User]]],
) -> ParticipantsPlan:
    """`resolved` pairs each typed name with the directory matches. Nothing is guessed: several
    matches are reported, never picked. Requester, assignee, current participants and repeats are
    ignored silently; the ticket holds at most MAX_PARTICIPANTS."""
    taken = {requester_id, *current}
    if assignee_id is not None:
        taken.add(assignee_id)
    to_add: list[User] = []
    over_limit: list[User] = []
    ambiguous: list[AmbiguousName] = []
    unknown: list[str] = []
    for name, matches in resolved:
        if not name.strip():
            continue
        if not matches:
            unknown.append(name)
        elif len(matches) > 1:
            ambiguous.append(AmbiguousName(name, tuple(u.display_name for u in matches)))
        else:
            user = matches[0]
            if user.id in taken:
                continue
            taken.add(user.id)
            if len(current) + len(to_add) >= MAX_PARTICIPANTS:
                over_limit.append(user)
            else:
                to_add.append(user)
    return ParticipantsPlan(tuple(to_add), tuple(ambiguous), tuple(unknown), tuple(over_limit))


# --- update


@dataclass(frozen=True)
class UpdatePlan:
    before: Mapping[str, str]
    after: Mapping[str, str]


def _clean_value(field: str, value: object) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if field in ("impact", "urgency"):
        return cleaned if cleaned in _LEVELS else None
    limit = MAX_SUMMARY if field == "summary" else MAX_DESCRIPTION
    return cleaned if cleaned and len(cleaned) <= limit else None


def plan_update(
    ticket: Ticket, changes: Mapping[str, object], confirmation: WriteConfirmation | None
) -> UpdatePlan | UpdateRefusal:
    """Only summary, description, impact and urgency; values equal to the current ones drop out."""
    refusal = _requester_write(ticket, confirmation)
    if refusal is not None:
        return refusal
    if any(field not in UPDATABLE_FIELDS for field in changes):
        return "unknown-field"
    before: dict[str, str] = {}
    after: dict[str, str] = {}
    for field, raw in changes.items():
        value = _clean_value(field, raw)
        if value is None:
            return "invalid-value"
        current = getattr(ticket, field)
        if value != current:
            before[field], after[field] = current, value
    if not after:
        return "no-changes"
    return UpdatePlan(before=before, after=after)


def update_event_body(plan: UpdatePlan) -> str:
    """Timeline body of an `updated` event: {field: {before, after}} as JSON."""
    return json.dumps(
        {f: {"before": plan.before[f], "after": plan.after[f]} for f in plan.after},
        ensure_ascii=False,
    )


# --- close


def check_close(ticket: Ticket, confirmation: WriteConfirmation | None) -> CloseRefusal | None:
    """The requester or IT may close, only once IT marked the ticket Resuelto."""
    if confirmation is None or confirmation.by != "human":
        return "missing-human-confirmation"
    if confirmation.actor_id != ticket.requester_id and confirmation.actor_role != "it":
        return "not-allowed"
    if ticket.status == "closed":
        return "already-closed"
    if ticket.status != "resolved":
        return "not-resolved"
    return None
