"""The writes Ariadna may only PROPOSE: participants, update and close.

Each one runs only here, with a human confirmation built from the session user. Foreign, unknown
and malformed ticket ids are the same `WriteNotFound`.
"""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from app.modules.auth.application.ports import UserDirectory
from app.modules.auth.domain.user import User
from app.modules.tickets.application.ports import TicketRepository
from app.modules.tickets.domain.access import can_view, owns_ticket, parse_ticket_id
from app.modules.tickets.domain.ticket import TicketRecord
from app.modules.tickets.domain.writes import (
    AmbiguousName,
    CloseRefusal,
    RequesterWriteRefusal,
    UpdateRefusal,
    WriteConfirmation,
    check_close,
    check_participants_write,
    plan_participants,
    plan_update,
    update_event_body,
)

Clock = Callable[[], datetime]


@dataclass(frozen=True)
class WriteCommand:
    """`actor` is the session user and `confirmed` the only thing the client says."""

    actor: User
    confirmed: bool


@dataclass(frozen=True)
class WriteNotFound:
    pass


@dataclass(frozen=True)
class ParticipantsDone:
    record: TicketRecord
    added: tuple[str, ...]  # display names
    ambiguous: tuple[AmbiguousName, ...]
    unknown: tuple[str, ...]
    over_limit: tuple[str, ...]


ParticipantsRefusal = RequesterWriteRefusal | Literal["no-names"]


@dataclass(frozen=True)
class ParticipantsRefused:
    reason: ParticipantsRefusal


@dataclass(frozen=True)
class UpdateDone:
    record: TicketRecord


@dataclass(frozen=True)
class UpdateRefused:
    reason: UpdateRefusal


@dataclass(frozen=True)
class CloseDone:
    record: TicketRecord


@dataclass(frozen=True)
class CloseRefused:
    reason: CloseRefusal


def _confirmation(command: WriteCommand) -> WriteConfirmation | None:
    # Built here, from the session: the client only says "confirmed".
    if not command.confirmed:
        return None
    return WriteConfirmation(
        by="human", actor_id=command.actor.id, actor_role=command.actor.role
    )


async def _load(repo: TicketRepository, display_id: str) -> TicketRecord | None:
    number = parse_ticket_id(display_id)
    return await repo.get(number) if number is not None else None


async def add_participants(
    repo: TicketRepository,
    directory: UserDirectory,
    display_id: str,
    names: Sequence[str],
    command: WriteCommand,
    clock: Clock,
) -> ParticipantsDone | ParticipantsRefused | WriteNotFound:
    """Names are resolved here, never trusted as ids; ambiguity is reported, not guessed."""
    record = await _load(repo, display_id)
    if record is None or not owns_ticket(command.actor, record.view.ticket):
        return WriteNotFound()
    ticket = record.view.ticket
    refusal = check_participants_write(ticket, _confirmation(command))
    if refusal is not None:
        return ParticipantsRefused(refusal)
    typed = [n.strip() for n in names if n.strip()]
    if not typed:
        return ParticipantsRefused("no-names")

    resolved = [(name, await directory.find_by_name(name)) for name in typed]
    plan = plan_participants(
        requester_id=ticket.requester_id,
        assignee_id=ticket.assignee_id,
        current=record.participants,
        resolved=resolved,
    )
    if plan.to_add:
        written = await repo.add_participants(
            ticket.number,
            [u.id for u in plan.to_add],
            command.actor.id,
            ", ".join(u.display_name for u in plan.to_add),
            clock(),
        )
        if written is None:
            return ParticipantsRefused("ticket-closed")
        record = written
    return ParticipantsDone(
        record=record,
        added=tuple(u.display_name for u in plan.to_add),
        ambiguous=plan.ambiguous,
        unknown=plan.unknown,
        over_limit=tuple(u.display_name for u in plan.over_limit),
    )


async def update_ticket(
    repo: TicketRepository,
    display_id: str,
    changes: Mapping[str, object],
    command: WriteCommand,
    clock: Clock,
) -> UpdateDone | UpdateRefused | WriteNotFound:
    record = await _load(repo, display_id)
    if record is None or not owns_ticket(command.actor, record.view.ticket):
        return WriteNotFound()
    plan = plan_update(record.view.ticket, changes, _confirmation(command))
    if isinstance(plan, str):
        return UpdateRefused(plan)
    written = await repo.update_ticket(
        record.view.ticket.number, plan.after, command.actor.id, update_event_body(plan), clock()
    )
    if written is None:
        return UpdateRefused("ticket-closed")
    return UpdateDone(written)


async def close_ticket(
    repo: TicketRepository, display_id: str, command: WriteCommand, clock: Clock
) -> CloseDone | CloseRefused | WriteNotFound:
    """The requester or IT, once the ticket is Resuelto; the event author is who confirmed."""
    record = await _load(repo, display_id)
    if record is None or not can_view(command.actor, record.view.ticket):
        return WriteNotFound()
    refusal = check_close(record.view.ticket, _confirmation(command))
    if refusal is not None:
        return CloseRefused(refusal)
    written = await repo.close(record.view.ticket.number, command.actor.id, clock())
    if written is None:
        return CloseRefused("not-resolved")
    return CloseDone(written)
