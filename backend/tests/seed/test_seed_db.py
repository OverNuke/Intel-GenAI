"""Real-database test. MUTATES the target DB: use a throwaway Neon branch.

Skipped unless DATABASE_URL is set (never set by the test suite itself).
"""

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.seed.run import run
from app.shared.config import get_settings, migration_url
from app.shared.db import sync_engine

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL is not set (real-DB test)"
)

BACKEND = Path(__file__).resolve().parents[2]


def _counts(url: str) -> tuple[int, int]:
    engine = sync_engine(url)
    try:
        with engine.connect() as connection:
            users = connection.execute(text("SELECT count(*) FROM users")).scalar_one()
            tickets = connection.execute(text("SELECT count(*) FROM tickets")).scalar_one()
        return users, tickets
    finally:
        engine.dispose()


def _next_sequence_value(url: str) -> int:
    """Peek the next id WITHOUT consuming it (no nextval)."""
    engine = sync_engine(url)
    try:
        with engine.connect() as connection:
            row = connection.execute(
                text("SELECT last_value, is_called FROM ticket_number_seq")
            ).one()
        last_value, is_called = row
        return int(last_value) + 1 if is_called else int(last_value)
    finally:
        engine.dispose()


def _users(url: str) -> dict[str, tuple[str, str]]:
    engine = sync_engine(url)
    try:
        with engine.connect() as connection:
            rows = connection.execute(text("SELECT id, email, area FROM users")).all()
        return {row.id: (row.email, row.area) for row in rows}
    finally:
        engine.dispose()


def test_seed_users_have_area_and_mock_emails_and_reseeding_realigns_stale_rows() -> None:
    get_settings.cache_clear()
    url = migration_url(get_settings())
    command.upgrade(Config(str(BACKEND / "alembic.ini")), "head")

    run(url)
    expected = {
        "ana": ("ana.ruiz@ejemplo.mx", "Finanzas"),
        "luis": ("luis.herrera@ejemplo.mx", "Mesa de ayuda"),
        "sara": ("sara.molina@ejemplo.mx", "Supervisión"),
    }
    assert _users(url) == expected

    engine = sync_engine(url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text("UPDATE users SET email = 'stale@ariadna.example', area = '' WHERE id = 'ana'")
            )
    finally:
        engine.dispose()
    run(url)
    assert _users(url) == expected


def test_upgrade_then_seed_twice_has_no_duplicates_and_next_id_is_1061() -> None:
    get_settings.cache_clear()
    url = migration_url(get_settings())
    command.upgrade(Config(str(BACKEND / "alembic.ini")), "head")

    run(url)
    first = _counts(url)
    run(url)
    second = _counts(url)

    assert first == second == (3, 8)
    assert _next_sequence_value(url) == 1061
