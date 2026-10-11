from dataclasses import replace
from datetime import UTC, datetime

import pytest

from app.modules.auth.domain.user import User
from app.modules.tickets.domain.access import (
    can_view,
    owns_ticket,
    parse_ticket_id,
    summarize_mine,
)
from app.modules.tickets.domain.ticket import Ticket

ANA = User(id="ana", display_name="Ana Ruiz", email="a@x.mx", role="user", area="Finanzas")
LUIS = User(id="luis", display_name="Luis", email="l@x.mx", role="it", area="Mesa de ayuda")
SARA = User(id="sara", display_name="Sara", email="s@x.mx", role="supervisor", area="Sup")


def _ticket(**changes: object) -> Ticket:
    now = datetime(2026, 1, 5, 9, 0, tzinfo=UTC)
    base = Ticket(
        number=1053,
        summary="Sin red",
        description="No hay red",
        service="network",
        status="new",
        awaiting_user=False,
        priority="high",
        impact="medium",
        urgency="high",
        assigned_group="Soporte TI",
        assignee_id=None,
        requester_id="ana",
        asset=None,
        via_ariadna=False,
        sla_due_at=None,
        created_at=now,
        updated_at=now,
    )
    return replace(base, **changes)  # type: ignore[arg-type]


def test_requester_owns_and_can_view_their_ticket() -> None:
    assert owns_ticket(ANA, _ticket()) is True
    assert can_view(ANA, _ticket()) is True


def test_a_supervisor_neither_owns_nor_views_someone_elses_ticket() -> None:
    assert owns_ticket(SARA, _ticket()) is False
    assert can_view(SARA, _ticket()) is False


def test_it_can_view_any_ticket_but_does_not_own_it() -> None:
    assert can_view(LUIS, _ticket()) is True
    assert owns_ticket(LUIS, _ticket()) is False


def test_it_owns_and_views_the_tickets_they_requested() -> None:
    mine = _ticket(requester_id="luis")
    assert owns_ticket(LUIS, mine) is True


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("INC0001061", 1061),
        ("INC0001053", 1053),
        ("INC0000001", 1),
        ("INC1061", None),
        ("inc0001061", None),
        ("INC00010611", None),
        ("INC000106X", None),
        ("0001061", None),
        ("", None),
    ],
)
def test_parse_ticket_id(raw: str, expected: int | None) -> None:
    assert parse_ticket_id(raw) == expected


def test_summarize_mine_counts_each_bucket_from_the_same_tickets() -> None:
    tickets = [
        _ticket(number=1, status="new"),
        _ticket(number=2, status="in_progress", awaiting_user=True),
        _ticket(number=3, status="assigned"),
        _ticket(number=4, status="resolved"),
        _ticket(number=5, status="closed"),
        _ticket(number=6, status="closed"),
    ]
    summary = summarize_mine(tickets)
    assert (summary.open, summary.awaiting, summary.resolved, summary.closed) == (3, 1, 1, 2)


def test_summarize_mine_awaiting_ignores_closed_and_resolved_tickets() -> None:
    summary = summarize_mine(
        [_ticket(number=1, status="resolved", awaiting_user=True), _ticket(number=2)]
    )
    assert summary.awaiting == 0
    assert summary.open == 1
