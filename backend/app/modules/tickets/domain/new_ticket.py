"""Rules for a ticket created from a confirmed draft (REQ-TS-4, REQ-TS-5)."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from app.modules.catalog.domain.services import get_service
from app.modules.tickets.domain.submit_ticket import TicketDraft
from app.modules.tickets.domain.ticket import Impact, Priority, Urgency

DEFAULT_LEVEL: Impact = "medium"
UNKNOWN_GROUP = "Mesa de ayuda general"

_SCORE: dict[str, int] = {"low": 1, "medium": 2, "high": 3}
_SLA_HOURS: dict[Priority, int] = {"critical": 4, "high": 8, "medium": 24, "low": 72}


def priority_for(impact: Impact, urgency: Urgency) -> Priority:
    """high+high critical, sum 5 high, sums 3-4 medium, low+low low (matches the seed)."""
    total = _SCORE[impact] + _SCORE[urgency]
    if total >= 6:
        return "critical"
    if total == 5:
        return "high"
    if total >= 3:
        return "medium"
    return "low"


def sla_hours(priority: Priority) -> int:
    return _SLA_HOURS[priority]


@dataclass(frozen=True)
class NewTicket:
    """Everything the repository needs to create a ticket in status "new", unassigned."""

    summary: str
    description: str
    service: str
    impact: Impact
    urgency: Urgency
    priority: Priority
    assigned_group: str
    requester_id: str
    via_ariadna: bool
    sla_due_at: datetime
    created_at: datetime
    submission_key: str | None = None


def build_new_ticket(
    draft: TicketDraft,
    *,
    impact: Impact | None,
    urgency: Urgency | None,
    via_ariadna: bool,
    now: datetime,
    submission_key: str | None = None,
) -> NewTicket:
    impact_level = impact or DEFAULT_LEVEL
    urgency_level = urgency or DEFAULT_LEVEL
    priority = priority_for(impact_level, urgency_level)
    service = get_service(draft.service)
    return NewTicket(
        summary=draft.summary.strip(),
        description=draft.description.strip(),
        service=draft.service,
        impact=impact_level,
        urgency=urgency_level,
        priority=priority,
        assigned_group=service.handled_by if service else UNKNOWN_GROUP,
        requester_id=draft.requester_id,
        via_ariadna=via_ariadna,
        sla_due_at=now + timedelta(hours=sla_hours(priority)),
        created_at=now,
        submission_key=submission_key,
    )
