from collections.abc import Callable
from datetime import UTC, datetime

from app.modules.tickets.application.ports import TicketRepository
from app.modules.tickets.infrastructure.sqlalchemy_tickets import SqlAlchemyTicketRepository
from app.shared.db import get_sessionmaker

# Composition root for the tickets module. Tests replace these via app.dependency_overrides.


def get_ticket_repository() -> TicketRepository:
    return SqlAlchemyTicketRepository(get_sessionmaker())


def get_clock() -> Callable[[], datetime]:
    """Injectable "now" (tests pin it): ticket creation time, SLA clock."""
    return lambda: datetime.now(UTC)
