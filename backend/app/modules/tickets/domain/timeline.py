from collections.abc import Iterable

from app.modules.tickets.domain.ticket import TicketEvent


def requester_events(events: Iterable[TicketEvent]) -> list[TicketEvent]:
    """What the requester may see (REQ-UT-7 / R12), oldest first."""
    visible = [e for e in events if e.visible_to_requester]
    return sorted(visible, key=lambda e: (e.created_at, e.id))


def contact_notice(events: Iterable[TicketEvent], *, awaiting_user: bool) -> str | None:
    """The message IT left in the latest contact request, only while the ticket is Pendiente."""
    if not awaiting_user:
        return None
    contacts = [e for e in events if e.kind == "contact_requested" and e.visible_to_requester]
    if not contacts:
        return None
    latest = max(contacts, key=lambda e: (e.created_at, e.id))
    return latest.body or None
