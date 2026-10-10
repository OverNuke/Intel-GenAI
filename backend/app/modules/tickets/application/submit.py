from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from app.modules.catalog.domain.services import get_service
from app.modules.tickets.application.ports import TicketRepository
from app.modules.tickets.domain.new_ticket import build_new_ticket
from app.modules.tickets.domain.receipt import AriadnaReceipt, with_person_statement
from app.modules.tickets.domain.submit_ticket import (
    Confirmation,
    SubmitFailure,
    TicketDraft,
    submit_ticket,
)
from app.modules.tickets.domain.ticket import Impact, TicketRecord, Urgency

Clock = Callable[[], datetime]


@dataclass(frozen=True)
class SubmitCommand:
    """What the session user confirmed. `requester_id` always comes from the session."""

    requester_id: str
    service: str
    summary: str
    description: str
    impact: Impact | None
    urgency: Urgency | None
    confirmed: bool
    receipt: AriadnaReceipt | None
    idempotency_key: str | None


@dataclass(frozen=True)
class SubmitOk:
    record: TicketRecord
    created: bool  # False when an earlier submission with the same key is returned


@dataclass(frozen=True)
class SubmitFailed:
    reason: Literal[
        "missing-human-confirmation",
        "confirmation-not-from-requester",
        "incomplete-draft",
        "unknown-service",
    ]


async def submit(
    repo: TicketRepository, command: SubmitCommand, clock: Clock
) -> SubmitOk | SubmitFailed:
    """Validation (domain `submit_ticket`) always runs before the repository is touched."""
    draft = TicketDraft(
        requester_id=command.requester_id,
        service=command.service,
        summary=command.summary,
        description=command.description,
    )
    # The confirmation is built here, from the session: the client only says "confirmed".
    confirmation = (
        Confirmation(by="human", requester_id=command.requester_id) if command.confirmed else None
    )
    outcome = submit_ticket(draft, confirmation)
    if isinstance(outcome, SubmitFailure):
        return SubmitFailed(outcome.reason)
    if get_service(draft.service) is None:
        return SubmitFailed("unknown-service")

    key = command.idempotency_key
    if key:
        existing = await repo.find_by_submission_key(key)
        if existing is not None:
            if existing.view.ticket.requester_id == command.requester_id:
                return SubmitOk(record=existing, created=False)
            key = None  # someone else's key: never hand out their ticket

    receipt = with_person_statement(command.receipt) if command.receipt else None
    new = build_new_ticket(
        draft,
        impact=command.impact,
        urgency=command.urgency,
        via_ariadna=receipt is not None,
        now=clock(),
        submission_key=key,
    )
    record = await repo.create(new, receipt)
    return SubmitOk(record=record, created=True)
