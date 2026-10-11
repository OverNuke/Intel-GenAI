"""Rules of "contactar al usuario" (REQ-IT-9..12)."""

from typing import Literal

from app.modules.tickets.domain.ticket import TicketStatus

MAX_CONTACT_MESSAGE = 500

ContactRefusal = Literal["ticket-finished", "message-too-long"]

_FINISHED: frozenset[TicketStatus] = frozenset({"resolved", "closed"})


def check_contact(status: TicketStatus, message: str | None) -> ContactRefusal | None:
    """Resolved/closed tickets are refused (409); contacting a Pendiente ticket is fine."""
    if status in _FINISHED:
        return "ticket-finished"
    if message is not None and len(message) > MAX_CONTACT_MESSAGE:
        return "message-too-long"
    return None
