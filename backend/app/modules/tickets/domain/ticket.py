from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from app.modules.tickets.domain.receipt import AriadnaReceipt

# The five RF-13 stages. "Pendiente" is NOT a stage: it is the `awaiting_user` flag.
TicketStatus = Literal["new", "assigned", "in_progress", "resolved", "closed"]
Priority = Literal["critical", "high", "medium", "low"]
Impact = Literal["high", "medium", "low"]
Urgency = Literal["high", "medium", "low"]
# "note" is reserved: nothing in the prototype writes it yet (phase 7).
TicketEventKind = Literal[
    "created",
    "assigned",
    "contact_requested",
    "note",
    "participants_added",
    "updated",
    "resolved",
    "closed",
]

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


@dataclass(frozen=True)
class TicketEvent:
    """One entry of the ticket timeline / bitácora."""

    id: str  # "{number}-{seq}"
    ticket_number: int
    kind: TicketEventKind
    author_id: str | None
    body: str | None
    visible_to_requester: bool
    created_at: datetime


@dataclass(frozen=True)
class TicketView:
    """A ticket plus the display names the screens need (requester and assignee)."""

    ticket: Ticket
    requester_name: str
    assignee_name: str | None


@dataclass(frozen=True)
class TicketRecord:
    """Full read model of one ticket: view + ordered events (oldest first)."""

    view: TicketView
    events: tuple[TicketEvent, ...] = ()
    receipt: AriadnaReceipt | None = None
    # user id -> display name of the people the events mention (author, requester, ...).
    people: Mapping[str, str] = field(default_factory=dict)
    # Ids of the users added besides requester and assignee, oldest first (names are in `people`).
    participants: tuple[str, ...] = ()
