"""Submit use case over the in-memory repository (the SQL adapter has its own gated test)."""

from datetime import UTC, datetime

import pytest

from app.modules.tickets.application.submit import SubmitCommand, SubmitFailed, SubmitOk, submit
from app.modules.tickets.domain.receipt import SUBMITTED_BY_PERSON, AriadnaReceipt
from tests.modules.tickets.fakes import InMemoryTicketRepository

NOW = datetime(2026, 10, 9, 12, 0, tzinfo=UTC)
RECEIPT = AriadnaReceipt(
    understood="La impresora del piso 2 no imprime.",
    reviewed=("Datos obligatorios completos",),
    not_done=(),
    permissions_notice=None,
    missing_data=(),
    target_group="Soporte de impresión",
)


def _command(**changes: object) -> SubmitCommand:
    base: dict[str, object] = {
        "requester_id": "ana",
        "service": "printing",
        "summary": "La impresora no imprime",
        "description": "Los documentos se quedan en la cola.",
        "impact": None,
        "urgency": None,
        "confirmed": True,
        "receipt": None,
        "idempotency_key": None,
    }
    return SubmitCommand(**{**base, **changes})  # type: ignore[arg-type]


def _clock() -> datetime:
    return NOW


async def test_confirmed_complete_draft_creates_the_next_ticket_as_new() -> None:
    repo = InMemoryTicketRepository()
    result = await submit(repo, _command(), _clock)
    assert isinstance(result, SubmitOk)
    ticket = result.record.view.ticket
    assert ticket.display_id == "INC0001061"
    assert ticket.status == "new"
    assert ticket.awaiting_user is False
    assert ticket.assignee_id is None
    assert ticket.requester_id == "ana"
    assert ticket.assigned_group == "Soporte de impresión"
    assert result.created is True
    assert [e.kind for e in result.record.events] == ["created"]
    assert [v.ticket.number for v in await repo.list_by_requester("ana")].count(1061) == 1


async def test_without_the_human_confirmation_nothing_is_created() -> None:
    """S-TS-2"""
    repo = InMemoryTicketRepository()
    before = len(await repo.list_all())
    result = await submit(repo, _command(confirmed=False), _clock)
    assert result == SubmitFailed("missing-human-confirmation")
    assert len(await repo.list_all()) == before


@pytest.mark.parametrize("field", ["summary", "description", "service"])
async def test_incomplete_draft_is_refused_without_creating_anything(field: str) -> None:
    """S-TS-4"""
    repo = InMemoryTicketRepository()
    before = len(await repo.list_all())
    result = await submit(repo, _command(**{field: "   "}), _clock)
    assert result == SubmitFailed("incomplete-draft")
    assert len(await repo.list_all()) == before


async def test_unknown_service_is_refused() -> None:
    repo = InMemoryTicketRepository()
    result = await submit(repo, _command(service="unknown-x"), _clock)
    assert result == SubmitFailed("unknown-service")


async def test_a_receipt_marks_the_ticket_via_ariadna_and_states_the_person_submitted() -> None:
    repo = InMemoryTicketRepository()
    result = await submit(repo, _command(receipt=RECEIPT), _clock)
    assert isinstance(result, SubmitOk)
    assert result.record.view.ticket.via_ariadna is True
    stored = result.record.receipt
    assert stored is not None
    assert stored.understood == RECEIPT.understood
    assert stored.not_done[-1] == SUBMITTED_BY_PERSON
    again = await repo.get(result.record.view.ticket.number)
    assert again is not None
    assert again.receipt == stored


async def test_without_a_receipt_the_ticket_is_not_via_ariadna() -> None:
    result = await submit(InMemoryTicketRepository(), _command(), _clock)
    assert isinstance(result, SubmitOk)
    assert result.record.view.ticket.via_ariadna is False
    assert result.record.receipt is None


async def test_the_same_idempotency_key_returns_the_same_ticket() -> None:
    """S-TS-6"""
    repo = InMemoryTicketRepository()
    first = await submit(repo, _command(idempotency_key="abc"), _clock)
    second = await submit(repo, _command(idempotency_key="abc"), _clock)
    assert isinstance(first, SubmitOk)
    assert isinstance(second, SubmitOk)
    assert first.created is True
    assert second.created is False
    assert first.record.view.ticket.number == second.record.view.ticket.number == 1061
    assert len(await repo.list_by_requester("ana")) == 9


async def test_different_keys_create_different_tickets() -> None:
    repo = InMemoryTicketRepository()
    first = await submit(repo, _command(idempotency_key="a"), _clock)
    second = await submit(repo, _command(idempotency_key="b"), _clock)
    assert isinstance(first, SubmitOk) and isinstance(second, SubmitOk)
    assert second.record.view.ticket.number == first.record.view.ticket.number + 1


async def test_a_key_already_used_by_another_requester_does_not_leak_their_ticket() -> None:
    repo = InMemoryTicketRepository()
    theirs = await submit(repo, _command(requester_id="luis", idempotency_key="shared"), _clock)
    mine = await submit(repo, _command(requester_id="ana", idempotency_key="shared"), _clock)
    assert isinstance(theirs, SubmitOk) and isinstance(mine, SubmitOk)
    assert mine.record.view.ticket.requester_id == "ana"
    assert mine.record.view.ticket.number != theirs.record.view.ticket.number
