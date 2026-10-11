from datetime import UTC, datetime, timedelta

import pytest

from app.modules.tickets.application.queue import list_queue
from app.modules.tickets.domain.sla import DUE_SOON_WINDOW, sla_state
from tests.modules.tickets.fakes import InMemoryTicketRepository

NOW = datetime(2026, 1, 14, 10, 0, tzinfo=UTC)


# --- sla_state (REQ-IT-4)


def test_past_due_is_overdue() -> None:
    assert sla_state(NOW - timedelta(minutes=1), NOW, "in_progress") == "overdue"


def test_due_exactly_now_is_due_soon_not_overdue() -> None:
    assert sla_state(NOW, NOW, "assigned") == "due_soon"


def test_within_the_four_hour_window_is_due_soon_and_beyond_it_on_time() -> None:
    assert timedelta(hours=4) == DUE_SOON_WINDOW
    assert sla_state(NOW + timedelta(hours=4), NOW, "new") == "due_soon"
    assert sla_state(NOW + timedelta(hours=4, seconds=1), NOW, "new") == "on_time"


def test_no_due_date_means_no_state() -> None:
    assert sla_state(None, NOW, "new") is None


@pytest.mark.parametrize("status", ["resolved", "closed"])
def test_finished_tickets_have_no_sla_state(status: str) -> None:
    assert sla_state(NOW - timedelta(days=3), NOW, status) is None  # type: ignore[arg-type]


# --- list_queue


async def test_queue_lists_every_requesters_tickets_newest_first() -> None:
    result = await list_queue(InMemoryTicketRepository(), "luis", lambda: NOW)
    numbers = [i.view.ticket.number for i in result.items]
    assert numbers == [1060, 1059, 1058, 1057, 1056, 1055, 1054, 1053]


async def test_items_carry_sla_state_and_whether_they_are_mine() -> None:
    result = await list_queue(InMemoryTicketRepository(), "luis", lambda: NOW)
    by_number = {i.view.ticket.number: i for i in result.items}
    assert by_number[1056].sla_state == "overdue"  # due Jan 8 15:00, now Jan 14
    assert by_number[1056].assigned_to_me is True
    assert by_number[1060].sla_state == "on_time"
    assert by_number[1058].sla_state == "on_time"
    assert by_number[1058].assigned_to_me is False
    assert by_number[1053].sla_state is None  # closed


async def test_queue_summary_counts_open_unassigned_mine_and_sla_risk() -> None:
    result = await list_queue(InMemoryTicketRepository(), "luis", lambda: NOW)
    summary = result.summary
    # open = 1055, 1056, 1057, 1058, 1059, 1060
    assert summary.open == 6
    assert summary.unassigned == 2  # 1058, 1059
    assert summary.assigned_to_me == 4  # 1055, 1056, 1057, 1060
    # overdue on Jan 14 10:00: 1055, 1056, 1057; 1060 is due at 16:00 (6h) so still on time.
    assert summary.sla_at_risk == 3


async def test_a_different_user_has_no_assigned_to_me_tickets() -> None:
    result = await list_queue(InMemoryTicketRepository(), "sara", lambda: NOW)
    assert result.summary.assigned_to_me == 0
    assert not any(i.assigned_to_me for i in result.items)


async def test_an_early_clock_leaves_tickets_on_time() -> None:
    early = datetime(2026, 1, 5, 9, 0, tzinfo=UTC)
    result = await list_queue(InMemoryTicketRepository(), "luis", lambda: early)
    assert {i.sla_state for i in result.items} == {"on_time", None}
    assert result.summary.sla_at_risk == 0
