"""Idempotent seed runner: `uv run python -m app.seed.run` (after `alembic upgrade head`).

Inserts explicit ticket numbers 1053..1060 (events with ON CONFLICT DO NOTHING; users upsert email
and area; tickets only fill a missing receipt) and never calls setval: the sequence keeps
starting at 1061 (see the initial migration).
"""

from dataclasses import asdict
from typing import Any

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import Insert, insert
from sqlalchemy.orm import Session

from app.modules.auth.infrastructure.models import UserRow
from app.modules.tickets.domain.receipt import receipt_to_json
from app.modules.tickets.infrastructure.models import TicketEventRow, TicketRow
from app.seed.data import EVENTS, RECEIPTS, TICKETS, USERS
from app.shared.config import get_settings, migration_url
from app.shared.db import sync_engine


def user_rows() -> list[dict[str, Any]]:
    return [asdict(user) for user in USERS]


def ticket_rows() -> list[dict[str, Any]]:
    rows = []
    for ticket in TICKETS:
        receipt = RECEIPTS.get(ticket.number)
        rows.append(
            {**asdict(ticket), "ariadna_receipt": receipt_to_json(receipt) if receipt else None}
        )
    return rows


def event_rows() -> list[dict[str, Any]]:
    return [asdict(event) for event in EVENTS]


def build_statements() -> tuple[Insert, Insert, Insert]:
    """Users first (tickets reference them), then tickets, then their events."""
    # Users upsert email/area so rows seeded before 0002 realign; tickets stay insert-only.
    users_insert = insert(UserRow).values(user_rows())
    users = users_insert.on_conflict_do_update(
        index_elements=["id"],
        set_={"email": users_insert.excluded.email, "area": users_insert.excluded.area},
    )
    # Tickets are never rewritten: a re-seed only fills a receipt that is still NULL.
    tickets_insert = insert(TicketRow).values(ticket_rows())
    tickets = tickets_insert.on_conflict_do_update(
        index_elements=["number"],
        set_={
            "ariadna_receipt": func.coalesce(
                TicketRow.ariadna_receipt, tickets_insert.excluded.ariadna_receipt
            )
        },
    )
    events = (
        insert(TicketEventRow).values(event_rows()).on_conflict_do_nothing(index_elements=["id"])
    )
    return users, tickets, events


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
