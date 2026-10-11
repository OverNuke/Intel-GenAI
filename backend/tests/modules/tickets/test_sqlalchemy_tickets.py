"""Real-database test: reads the seeded `tickets` table (run alembic + seed on a throwaway Neon
branch first). Skipped unless DATABASE_URL is set; the suite never sets it."""

import os
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from app.modules.tickets.domain.new_ticket import NewTicket
from app.modules.tickets.domain.receipt import AriadnaReceipt
from app.modules.tickets.infrastructure.sqlalchemy_tickets import SqlAlchemyTicketRepository
from app.seed.data import TICKETS
from app.shared.config import get_settings, to_psycopg_url
from app.shared.db import engine_options

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL is not set (real-DB test)"
)

# Tests that WRITE (consume ticket_number_seq, add events) would break test_seed_db's exact counts
# and "next id is 1061" check when run on the same branch, so they are opt-in: set
# ARIADNA_DB_WRITE_TESTS=1 on a throwaway branch, after test_seed_db, and re-seed afterwards.
writes = pytest.mark.skipif(
    not os.environ.get("ARIADNA_DB_WRITE_TESTS"),
    reason="ARIADNA_DB_WRITE_TESTS is not set (the test writes to the database)",
)


@pytest.fixture
async def repo() -> AsyncIterator[SqlAlchemyTicketRepository]:
    get_settings.cache_clear()
    url = get_settings().database_url
    assert url
    engine: AsyncEngine = create_async_engine(to_psycopg_url(url), **engine_options())
    try:
        yield SqlAlchemyTicketRepository(async_sessionmaker(bind=engine, expire_on_commit=False))
    finally:
        await engine.dispose()


async def test_list_by_requester_returns_the_seeded_tickets_with_names(
    repo: SqlAlchemyTicketRepository,
) -> None:
    views = await repo.list_by_requester("ana")
    seeded = {t.number: t for t in TICKETS}
    assert {v.ticket.number for v in views} >= set(seeded)
    first = next(v for v in views if v.ticket.number == 1056)
    assert first.requester_name == "Ana Ruiz"
    assert first.assignee_name == "Luis Herrera"
    assert first.ticket == seeded[1056]


async def test_unassigned_ticket_has_no_assignee_name(repo: SqlAlchemyTicketRepository) -> None:
    record = await repo.get(1058)
    assert record is not None
    assert record.view.assignee_name is None


async def test_list_all_includes_every_requester(repo: SqlAlchemyTicketRepository) -> None:
    assert len(await repo.list_all()) >= len(TICKETS)


async def test_get_unknown_number_is_none(repo: SqlAlchemyTicketRepository) -> None:
    assert await repo.get(999999) is None


async def test_get_loads_events_oldest_first_and_the_stored_receipt(
    repo: SqlAlchemyTicketRepository,
) -> None:
    pending = await repo.get(1056)
    assert pending is not None
    assert [e.kind for e in pending.events] == ["created", "assigned", "contact_requested"]
    via_ariadna = await repo.get(1055)
    assert via_ariadna is not None
    assert via_ariadna.receipt is not None
    assert via_ariadna.receipt.target_group == "Soporte de cuentas y accesos"


def _new(key: str | None = None) -> NewTicket:
    now = datetime(2026, 10, 9, 12, 0, tzinfo=UTC)
    return NewTicket(
        summary="Prueba de integración",
        description="Ticket creado por el test de base de datos.",
        service="printing",
        impact="medium",
        urgency="medium",
        priority="medium",
        assigned_group="Soporte de impresión",
        requester_id="ana",
        via_ariadna=True,
        sla_due_at=now,
        created_at=now,
        submission_key=key,
    )


@writes
async def test_create_allocates_a_number_writes_the_event_and_the_receipt(
    repo: SqlAlchemyTicketRepository,
) -> None:
    """MUTATES the target DB (consumes ticket_number_seq): throwaway branch only."""
    receipt = AriadnaReceipt("Entendí algo.", ("ok",), (), None, (), "Soporte de impresión")
    record = await repo.create(_new(), receipt)
    assert record.view.ticket.number >= 1061
    assert record.view.ticket.status == "new"
    assert [e.kind for e in record.events] == ["created"]
    assert record.receipt == receipt


@writes
async def test_the_same_submission_key_returns_the_first_ticket(
    repo: SqlAlchemyTicketRepository,
) -> None:
    key = f"test-{uuid.uuid4()}"
    first = await repo.create(_new(key), None)
    second = await repo.create(_new(key), None)
    assert first.view.ticket.number == second.view.ticket.number


@writes
async def test_request_contact_flags_pending_keeps_status_and_logs_the_event(
    repo: SqlAlchemyTicketRepository,
) -> None:
    """MUTATES the target DB (ticket 1060): throwaway branch only; re-seed to reset."""
    at = datetime(2026, 10, 9, 12, 0, tzinfo=UTC)
    before = await repo.get(1060)
    assert before is not None
    record = await repo.request_contact(1060, "luis", "Confirma la extensión", at)
    assert record is not None
    assert record.view.ticket.awaiting_user is True
    assert record.view.ticket.status == before.view.ticket.status
    assert record.events[-1].kind == "contact_requested"
    assert record.events[-1].body == "Confirma la extensión"
    assert record.people["luis"] == "Luis Herrera"
    assert await repo.request_contact(999999, "luis", None, at) is None


@writes
async def test_confirmed_writes_participants_update_and_close_round_trip(
    repo: SqlAlchemyTicketRepository,
) -> None:
    """MUTATES the target DB (tickets 1057 and 1054): throwaway branch only; re-seed to reset."""
    at = datetime(2026, 10, 11, 12, 0, tzinfo=UTC)
    added = await repo.add_participants(1057, ["sara", "sara"], "ana", "Sara Molina", at)
    assert added is not None
    assert added.participants == ("sara",)
    assert added.people["sara"] == "Sara Molina"
    assert added.events[-1].kind == "participants_added"

    changes = {"summary": "Acceso a la carpeta de finanzas"}
    updated = await repo.update_ticket(1057, changes, "ana", '{"summary": {}}', at)
    assert updated is not None
    assert updated.view.ticket.summary == "Acceso a la carpeta de finanzas"
    assert updated.events[-1].kind == "updated"

    assert await repo.close(1057, "ana", at) is None  # not Resuelto
    closed = await repo.close(1054, "ana", at)
    assert closed is not None
    assert closed.view.ticket.status == "closed"
    assert closed.events[-1].kind == "closed"
    assert await repo.update_ticket(1054, changes, "ana", "{}", at) is None  # closed now
