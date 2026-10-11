from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.catalog.domain.services import service_label
from app.modules.tickets.application.queue import Queue, QueueItem, QueueSummary
from app.modules.tickets.domain.access import MySummary
from app.modules.tickets.domain.receipt import (
    MAX_ITEM_TEXT,
    MAX_ITEMS,
    MAX_TEXT,
    AriadnaReceipt,
)
from app.modules.tickets.domain.sla import SlaState, sla_state
from app.modules.tickets.domain.ticket import (
    Impact,
    Priority,
    TicketEvent,
    TicketRecord,
    TicketStatus,
    TicketView,
    Urgency,
)
from app.modules.tickets.domain.timeline import contact_notice, requester_events


class MySummaryOut(BaseModel):
    open: int
    awaiting: int
    resolved: int
    closed: int


class TicketOut(BaseModel):
    """One row of U1/U2. Never carries requester or assignee ids."""

    id: str  # display id, INC0001061
    summary: str
    service: str  # catalog key; may be unknown to the catalog
    service_label: str
    status: TicketStatus
    awaiting_user: bool
    via_ariadna: bool
    asset: str | None
    created_at: datetime
    updated_at: datetime


class MyTicketsOut(BaseModel):
    summary: MySummaryOut
    tickets: list[TicketOut]


class TicketEventOut(BaseModel):
    id: str
    kind: str
    body: str | None
    created_at: datetime


class ReceiptOut(BaseModel):
    """The "Constancia de Ariadna", stored as submitted."""

    understood: str
    reviewed: list[str]
    not_done: list[str]
    permissions_notice: str | None
    missing_data: list[str]
    target_group: str


class TicketDetailOut(TicketOut):
    description: str
    impact: Impact
    urgency: Urgency
    assigned_group: str
    assignee_name: str | None
    events: list[TicketEventOut]
    contact_notice: str | None
    receipt: ReceiptOut | None


def summary_out(summary: MySummary) -> MySummaryOut:
    return MySummaryOut(
        open=summary.open,
        awaiting=summary.awaiting,
        resolved=summary.resolved,
        closed=summary.closed,
    )


def ticket_out(view: TicketView) -> TicketOut:
    t = view.ticket
    return TicketOut(
        id=t.display_id,
        summary=t.summary,
        service=t.service,
        service_label=service_label(t.service),
        status=t.status,
        awaiting_user=t.awaiting_user,
        via_ariadna=t.via_ariadna,
        asset=t.asset,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def event_out(event: TicketEvent) -> TicketEventOut:
    return TicketEventOut(
        id=event.id, kind=event.kind, body=event.body, created_at=event.created_at
    )


def receipt_out(receipt: AriadnaReceipt) -> ReceiptOut:
    return ReceiptOut(
        understood=receipt.understood,
        reviewed=list(receipt.reviewed),
        not_done=list(receipt.not_done),
        permissions_notice=receipt.permissions_notice,
        missing_data=list(receipt.missing_data),
        target_group=receipt.target_group,
    )


def detail_out(record: TicketRecord) -> TicketDetailOut:
    t = record.view.ticket
    return TicketDetailOut(
        **ticket_out(record.view).model_dump(),
        description=t.description,
        impact=t.impact,
        urgency=t.urgency,
        assigned_group=t.assigned_group,
        assignee_name=record.view.assignee_name,
        events=[event_out(e) for e in requester_events(record.events)],
        contact_notice=contact_notice(record.events, awaiting_user=t.awaiting_user),
        receipt=receipt_out(record.receipt) if record.receipt else None,
    )


class _Strict(BaseModel):
    """Unknown fields (requester_id, by, ...) are rejected instead of silently ignored."""

    model_config = ConfigDict(extra="forbid")


class SubmitDraftIn(_Strict):
    # Emptiness is judged by the domain (`incomplete-draft`), so no min_length here.
    service: str = Field(max_length=40)
    summary: str = Field(max_length=200)
    description: str = Field(max_length=4000)
    impact: Impact | None = None
    urgency: Urgency | None = None


class ReceiptIn(_Strict):
    understood: str = Field(min_length=1, max_length=MAX_TEXT)
    reviewed: list[Annotated[str, Field(max_length=MAX_ITEM_TEXT)]] = Field(
        default_factory=list, max_length=MAX_ITEMS
    )
    not_done: list[Annotated[str, Field(max_length=MAX_ITEM_TEXT)]] = Field(
        default_factory=list, max_length=MAX_ITEMS
    )
    permissions_notice: str | None = Field(default=None, max_length=MAX_TEXT)
    missing_data: list[Annotated[str, Field(max_length=MAX_ITEM_TEXT)]] = Field(
        default_factory=list, max_length=MAX_ITEMS
    )
    target_group: str = Field(default="", max_length=80)

    def to_domain(self) -> AriadnaReceipt:
        return AriadnaReceipt(
            understood=self.understood,
            reviewed=tuple(self.reviewed),
            not_done=tuple(self.not_done),
            permissions_notice=self.permissions_notice,
            missing_data=tuple(self.missing_data),
            target_group=self.target_group,
        )


class SubmitTicketIn(_Strict):
    """The requester is the session user: there is deliberately no requester or `by` field."""

    draft: SubmitDraftIn
    confirmed: bool = False
    receipt: ReceiptIn | None = None
    idempotency_key: str | None = Field(default=None, min_length=1, max_length=64)


class SubmitErrorOut(BaseModel):
    reason: Literal[
        "missing-human-confirmation",
        "confirmation-not-from-requester",
        "incomplete-draft",
        "unknown-service",
    ]


class QueueSummaryOut(BaseModel):
    open: int
    unassigned: int
    assigned_to_me: int
    sla_at_risk: int


class QueueRowOut(BaseModel):
    """One row of T1. Names only: no requester or assignee ids."""

    id: str
    summary: str
    requester_name: str
    status: TicketStatus
    awaiting_user: bool
    priority: Priority
    sla_due_at: datetime | None
    sla_state: SlaState | None
    assignee_name: str | None
    assigned_to_me: bool
    via_ariadna: bool
    created_at: datetime
    updated_at: datetime


class QueueOut(BaseModel):
    summary: QueueSummaryOut
    tickets: list[QueueRowOut]


def queue_row_out(item: QueueItem) -> QueueRowOut:
    t = item.view.ticket
    return QueueRowOut(
        id=t.display_id,
        summary=t.summary,
        requester_name=item.view.requester_name,
        status=t.status,
        awaiting_user=t.awaiting_user,
        priority=t.priority,
        sla_due_at=t.sla_due_at,
        sla_state=item.sla_state,
        assignee_name=item.view.assignee_name,
        assigned_to_me=item.assigned_to_me,
        via_ariadna=t.via_ariadna,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def queue_out(queue: Queue) -> QueueOut:
    summary: QueueSummary = queue.summary
    return QueueOut(
        summary=QueueSummaryOut(
            open=summary.open,
            unassigned=summary.unassigned,
            assigned_to_me=summary.assigned_to_me,
            sla_at_risk=summary.sla_at_risk,
        ),
        tickets=[queue_row_out(i) for i in queue.items],
    )


class ItEventOut(BaseModel):
    """Bitácora entry: includes events the requester cannot see and who wrote them."""

    id: str
    kind: str
    body: str | None
    author_name: str | None
    visible_to_requester: bool
    created_at: datetime


class ItTicketOut(BaseModel):
    """T2 record. Names only: no requester or assignee ids."""

    id: str
    summary: str
    description: str
    service: str
    service_label: str
    status: TicketStatus
    awaiting_user: bool
    priority: Priority
    impact: Impact
    urgency: Urgency
    assigned_group: str
    assignee_name: str | None
    requester_name: str
    asset: str | None
    via_ariadna: bool
    sla_due_at: datetime | None
    sla_state: SlaState | None
    created_at: datetime
    updated_at: datetime
    events: list[ItEventOut]
    receipt: ReceiptOut | None


class ContactIn(_Strict):
    message: str | None = Field(default=None, max_length=500)


class ContactErrorOut(BaseModel):
    reason: Literal["ticket-finished", "message-too-long"]


def it_record_out(record: TicketRecord, now: datetime) -> ItTicketOut:
    t = record.view.ticket
    return ItTicketOut(
        id=t.display_id,
        summary=t.summary,
        description=t.description,
        service=t.service,
        service_label=service_label(t.service),
        status=t.status,
        awaiting_user=t.awaiting_user,
        priority=t.priority,
        impact=t.impact,
        urgency=t.urgency,
        assigned_group=t.assigned_group,
        assignee_name=record.view.assignee_name,
        requester_name=record.view.requester_name,
        asset=t.asset,
        via_ariadna=t.via_ariadna,
        sla_due_at=t.sla_due_at,
        sla_state=sla_state(t.sla_due_at, now, t.status),
        created_at=t.created_at,
        updated_at=t.updated_at,
        events=[
            ItEventOut(
                id=e.id,
                kind=e.kind,
                body=e.body,
                author_name=record.people.get(e.author_id) if e.author_id else None,
                visible_to_requester=e.visible_to_requester,
                created_at=e.created_at,
            )
            for e in sorted(record.events, key=lambda e: (e.created_at, e.id))
        ],
        receipt=receipt_out(record.receipt) if record.receipt else None,
    )
