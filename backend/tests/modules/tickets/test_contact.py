"""contact_user: the only T2 action of this change (REQ-IT-9..12, REQ-IT-14)."""

from datetime import UTC, datetime

import pytest

from app.modules.tickets.application.contact import (
    ContactDone,
    ContactNotFound,
    ContactRefused,
    contact_requester,
)
from app.modules.tickets.domain.contact import MAX_CONTACT_MESSAGE, check_contact
from tests.modules.tickets.fakes import InMemoryTicketRepository

NOW = datetime(2026, 1, 14, 10, 0, tzinfo=UTC)


# --- domain rules


@pytest.mark.parametrize("status", ["resolved", "closed"])
def test_finished_tickets_cannot_be_contacted(status: str) -> None:
    assert check_contact(status, "hola") == "ticket-finished"  # type: ignore[arg-type]


@pytest.mark.parametrize("status", ["new", "assigned", "in_progress"])
def test_open_tickets_can_be_contacted_with_or_without_a_message(status: str) -> None:
    assert check_contact(status, None) is None  # type: ignore[arg-type]
    assert check_contact(status, "Confirma la extensión") is None  # type: ignore[arg-type]


def test_message_is_bounded() -> None:
    assert check_contact("new", "x" * MAX_CONTACT_MESSAGE) is None
    assert check_contact("new", "x" * (MAX_CONTACT_MESSAGE + 1)) == "message-too-long"


# --- use case over the fake repository


async def test_s_it_8_contact_sets_pending_keeps_status_and_records_the_event() -> None:
    repo = InMemoryTicketRepository()
    result = await contact_requester(
        repo, "luis", "INC0001060", "Confirma la extensión del teléfono", lambda: NOW
    )
    assert isinstance(result, ContactDone)
    ticket = result.record.view.ticket
    assert ticket.awaiting_user is True
    assert ticket.status == "assigned"
    assert ticket.updated_at == NOW
    event = result.record.events[-1]
    assert event.kind == "contact_requested"
    assert event.body == "Confirma la extensión del teléfono"
    assert event.author_id == "luis"
    assert event.visible_to_requester is True
    again = await repo.get(1060)
    assert again is not None
    assert again.view.ticket.awaiting_user is True


async def test_s_it_10_closed_ticket_is_refused_and_unchanged() -> None:
    repo = InMemoryTicketRepository()
    result = await contact_requester(repo, "luis", "INC0001053", "hola", lambda: NOW)
    assert result == ContactRefused("ticket-finished")
    record = await repo.get(1053)
    assert record is not None
    assert record.view.ticket.awaiting_user is False
    assert record.events == ()


async def test_s_it_11_already_pending_stays_pending_and_does_not_error() -> None:
    repo = InMemoryTicketRepository()
    result = await contact_requester(repo, "luis", "INC0001056", "Otro dato", lambda: NOW)
    assert isinstance(result, ContactDone)
    assert result.record.view.ticket.awaiting_user is True


async def test_unknown_or_malformed_ids_are_not_found() -> None:
    repo = InMemoryTicketRepository()
    unknown = await contact_requester(repo, "luis", "INC0009999", None, lambda: NOW)
    malformed = await contact_requester(repo, "luis", "nope", None, lambda: NOW)
    assert unknown == ContactNotFound()
    assert malformed == ContactNotFound()


async def test_an_empty_message_is_stored_as_none() -> None:
    repo = InMemoryTicketRepository()
    result = await contact_requester(repo, "luis", "INC0001060", "   ", lambda: NOW)
    assert isinstance(result, ContactDone)
    assert result.record.events[-1].body is None


async def test_too_long_message_is_refused() -> None:
    repo = InMemoryTicketRepository()
    result = await contact_requester(repo, "luis", "INC0001060", "x" * 501, lambda: NOW)
    assert result == ContactRefused("message-too-long")


async def test_pending_is_never_cleared_by_anything_in_this_change() -> None:
    repo = InMemoryTicketRepository()
    await contact_requester(repo, "luis", "INC0001060", "uno", lambda: NOW)
    await contact_requester(repo, "luis", "INC0001060", "dos", lambda: NOW)
    record = await repo.get(1060)
    assert record is not None
    assert record.view.ticket.awaiting_user is True
    assert [e.kind for e in record.events] == ["contact_requested", "contact_requested"]
    assert len({e.id for e in record.events}) == 2
