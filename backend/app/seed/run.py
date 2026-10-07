"""Idempotent seed runner: `uv run python -m app.seed.run` (after `alembic upgrade head`).

Inserts explicit ticket numbers 1053..1060 with ON CONFLICT DO NOTHING and never calls
setval: the sequence keeps starting at 1061 (see the initial migration).
"""

from dataclasses import asdict
from typing import Any

from sqlalchemy.dialects.postgresql import Insert, insert
from sqlalchemy.orm import Session

from app.modules.auth.infrastructure.models import UserRow
from app.modules.tickets.infrastructure.models import TicketRow
from app.seed.data import TICKETS, USERS
from app.shared.config import get_settings, migration_url
from app.shared.db import sync_engine


def user_rows() -> list[dict[str, Any]]:
    return [asdict(user) for user in USERS]


def ticket_rows() -> list[dict[str, Any]]:
    return [asdict(ticket) for ticket in TICKETS]


def build_statements() -> tuple[Insert, Insert]:
    """Users first (tickets reference them), then tickets."""
    users = insert(UserRow).values(user_rows()).on_conflict_do_nothing(index_elements=["id"])
    tickets = (
        insert(TicketRow).values(ticket_rows()).on_conflict_do_nothing(index_elements=["number"])
    )
    return users, tickets


def run(url: str) -> None:
    engine = sync_engine(url)
    try:
        with Session(engine) as session, session.begin():
            for statement in build_statements():
                session.execute(statement)
    finally:
        engine.dispose()


def main() -> None:
    run(migration_url(get_settings()))


if __name__ == "__main__":
    main()
