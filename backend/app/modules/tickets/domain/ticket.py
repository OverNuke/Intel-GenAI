from dataclasses import dataclass
from datetime import datetime
from typing import Literal

# The five RF-13 stages. "Pendiente" is NOT a stage: it is the `awaiting_user` flag.
TicketStatus = Literal["new", "assigned", "in_progress", "resolved", "closed"]
Priority = Literal["critical", "high", "medium", "low"]
Impact = Literal["high", "medium", "low"]
Urgency = Literal["high", "medium", "low"]

TICKET_ID_PREFIX = "INC"
TICKET_ID_DIGITS = 7


def format_ticket_id(number: int) -> str:
    """Display id of a ticket: 1061 -> INC0001061."""
    return f"{TICKET_ID_PREFIX}{number:0{TICKET_ID_DIGITS}d}"


@dataclass(frozen=True)
class Ticket:
    number: int
    summary: str
    description: str
    service: str
    status: TicketStatus
    awaiting_user: bool
    priority: Priority
    impact: Impact
    urgency: Urgency
    assigned_group: str
    assignee_id: str | None
    requester_id: str
    asset: str | None
    via_ariadna: bool
    sla_due_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @property
    def display_id(self) -> str:
        return format_ticket_id(self.number)
