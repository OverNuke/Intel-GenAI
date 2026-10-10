from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from app.modules.tickets.application.ports import TicketRepository
from app.modules.tickets.domain.sla import SlaState, sla_state
from app.modules.tickets.domain.ticket import TicketView

_FINISHED = frozenset({"resolved", "closed"})


@dataclass(frozen=True)
class QueueItem:
    view: TicketView
    sla_state: SlaState | None
    assigned_to_me: bool


@dataclass(frozen=True)
class QueueSummary:
    open: int
    unassigned: int
    assigned_to_me: int
    sla_at_risk: int  # open tickets that are overdue or due soon


@dataclass(frozen=True)
class Queue:
    items: list[QueueItem]
    summary: QueueSummary


def summarize_queue(items: list[QueueItem]) -> QueueSummary:
    open_items = [i for i in items if i.view.ticket.status not in _FINISHED]
    return QueueSummary(
        open=len(open_items),
        unassigned=sum(1 for i in open_items if i.view.ticket.assignee_id is None),
        assigned_to_me=sum(1 for i in open_items if i.assigned_to_me),
        sla_at_risk=sum(1 for i in open_items if i.sla_state in ("overdue", "due_soon")),
    )


async def list_queue(
    repo: TicketRepository, user_id: str, clock: Callable[[], datetime]
) -> Queue:
    """Every ticket of every requester, newest first, with its SLA state at `clock()`."""
    now = clock()
    views = sorted(
        await repo.list_all(),
        key=lambda v: (v.ticket.created_at, v.ticket.number),
        reverse=True,
    )
    items = [
        QueueItem(
            view=view,
            sla_state=sla_state(view.ticket.sla_due_at, now, view.ticket.status),
            assigned_to_me=view.ticket.assignee_id == user_id,
        )
        for view in views
    ]
    return Queue(items=items, summary=summarize_queue(items))
