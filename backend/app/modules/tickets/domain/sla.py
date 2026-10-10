"""SLA state from the due date against an injectable clock (REQ-IT-4)."""

from datetime import datetime, timedelta
from typing import Literal

from app.modules.tickets.domain.ticket import TicketStatus

SlaState = Literal["overdue", "due_soon", "on_time"]

# A ticket is "por vencer" when its due date is at most this far away.
DUE_SOON_WINDOW = timedelta(hours=4)

_FINISHED: frozenset[TicketStatus] = frozenset({"resolved", "closed"})


def sla_state(due_at: datetime | None, now: datetime, status: TicketStatus) -> SlaState | None:
    """None without a due date and for finished tickets (the clock no longer applies)."""
    if due_at is None or status in _FINISHED:
        return None
    if due_at < now:
        return "overdue"
    if due_at - now <= DUE_SOON_WINDOW:
        return "due_soon"
    return "on_time"
