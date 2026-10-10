from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from app.modules.tickets.application.ports import TicketRepository
from app.modules.tickets.domain.access import parse_ticket_id
from app.modules.tickets.domain.contact import ContactRefusal, check_contact
from app.modules.tickets.domain.ticket import TicketRecord


@dataclass(frozen=True)
class ContactDone:
    record: TicketRecord


@dataclass(frozen=True)
class ContactNotFound:
    pass


@dataclass(frozen=True)
class ContactRefused:
    reason: ContactRefusal


async def contact_requester(
    repo: TicketRepository,
    by_user_id: str,
    display_id: str,
    message: str | None,
    clock: Callable[[], datetime],
) -> ContactDone | ContactNotFound | ContactRefused:
    """Sets the Pendiente flag and appends the event; status never changes.

    The caller has already established that the user is IT (section `ticket-tracking`).
    """
    number = parse_ticket_id(display_id)
    record = await repo.get(number) if number is not None else None
    if number is None or record is None:
        return ContactNotFound()
    cleaned = (message or "").strip() or None
    refusal = check_contact(record.view.ticket.status, cleaned)
    if refusal is not None:
        return ContactRefused(refusal)
    updated = await repo.request_contact(number, by_user_id, cleaned, clock())
    return ContactDone(updated) if updated is not None else ContactNotFound()
