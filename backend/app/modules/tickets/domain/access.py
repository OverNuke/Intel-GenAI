"""Who may see which ticket, id parsing and the requester's four summary counters."""

import re
from dataclasses import dataclass

from app.modules.auth.domain.user import User
from app.modules.tickets.domain.ticket import (
    TICKET_ID_DIGITS,
    TICKET_ID_PREFIX,
    Ticket,
)

_OPEN_STATUSES = frozenset({"new", "assigned", "in_progress"})
_ID_PATTERN = re.compile(rf"^{TICKET_ID_PREFIX}(\d{{{TICKET_ID_DIGITS}}})$")


def owns_ticket(user: User, ticket: Ticket) -> bool:
    """The user-facing API (U1-U3) only ever serves the requester's own tickets."""
    return ticket.requester_id == user.id


def can_view(user: User, ticket: Ticket) -> bool:
    """Requester, or any IT user (the IT desk API)."""
    return owns_ticket(user, ticket) or user.role == "it"


def parse_ticket_id(raw: str) -> int | None:
    """"INC0001061" -> 1061; anything else is None (the API answers 404)."""
    match = _ID_PATTERN.match(raw)
    return int(match.group(1)) if match else None


@dataclass(frozen=True)
class MySummary:
    open: int
    awaiting: int
    resolved: int
    closed: int


def summarize_mine(tickets: list[Ticket]) -> MySummary:
    """open = new/assigned/in_progress; awaiting = open tickets flagged Pendiente."""
    return MySummary(
        open=sum(1 for t in tickets if t.status in _OPEN_STATUSES),
        awaiting=sum(1 for t in tickets if t.awaiting_user and t.status in _OPEN_STATUSES),
        resolved=sum(1 for t in tickets if t.status == "resolved"),
        closed=sum(1 for t in tickets if t.status == "closed"),
    )
