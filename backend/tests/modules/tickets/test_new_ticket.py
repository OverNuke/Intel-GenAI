from datetime import UTC, datetime, timedelta

import pytest

from app.modules.tickets.domain.new_ticket import (
    build_new_ticket,
    priority_for,
    sla_hours,
)
from app.modules.tickets.domain.submit_ticket import TicketDraft
from app.seed.data import TICKETS

NOW = datetime(2026, 10, 9, 12, 0, tzinfo=UTC)
DRAFT = TicketDraft(
    requester_id="ana",
    service="printing",
    summary="La impresora no imprime",
    description="Los documentos se quedan en la cola.",
)


@pytest.mark.parametrize(
    ("impact", "urgency", "priority"),
    [
        ("high", "high", "critical"),
        ("high", "medium", "high"),
        ("medium", "high", "high"),
        ("medium", "medium", "medium"),
        ("high", "low", "medium"),
        ("low", "medium", "medium"),
        ("low", "low", "low"),
    ],
)
def test_priority_is_derived_from_impact_and_urgency(
    impact: str, urgency: str, priority: str
) -> None:
    assert priority_for(impact, urgency) == priority  # type: ignore[arg-type]


def test_priority_rule_agrees_with_every_seeded_ticket() -> None:
    for ticket in TICKETS:
        assert priority_for(ticket.impact, ticket.urgency) == ticket.priority, ticket.number


@pytest.mark.parametrize(
    ("priority", "hours"), [("critical", 4), ("high", 8), ("medium", 24), ("low", 72)]
)
def test_sla_hours_per_priority(priority: str, hours: int) -> None:
    assert sla_hours(priority) == hours  # type: ignore[arg-type]


def test_defaults_are_medium_with_the_catalog_group_and_a_sla() -> None:
    new = build_new_ticket(DRAFT, impact=None, urgency=None, via_ariadna=True, now=NOW)
    assert (new.impact, new.urgency, new.priority) == ("medium", "medium", "medium")
    assert new.assigned_group == "Soporte de impresión"
    assert new.sla_due_at == NOW + timedelta(hours=24)
    assert new.created_at == NOW
    assert new.requester_id == "ana"
    assert new.via_ariadna is True
    assert new.submission_key is None


def test_explicit_impact_and_urgency_drive_priority_and_sla() -> None:
    new = build_new_ticket(
        DRAFT, impact="high", urgency="high", via_ariadna=False, now=NOW, submission_key="k-1"
    )
    assert new.priority == "critical"
    assert new.sla_due_at == NOW + timedelta(hours=4)
    assert new.via_ariadna is False
    assert new.submission_key == "k-1"


def test_summary_and_description_are_trimmed_and_the_service_is_kept() -> None:
    draft = TicketDraft("ana", "network", "  VPN caída  ", "  No conecta \n", )
    new = build_new_ticket(draft, impact=None, urgency=None, via_ariadna=False, now=NOW)
    assert (new.summary, new.description, new.service) == ("VPN caída", "No conecta", "network")
    assert new.assigned_group == "Soporte de redes"
