from io import StringIO
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

BACKEND = Path(__file__).resolve().parents[2]


@pytest.fixture(autouse=True)
def _no_database(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL_UNPOOLED", raising=False)


def _config(buffer: StringIO | None = None) -> Config:
    return Config(str(BACKEND / "alembic.ini"), output_buffer=buffer)


def _upgrade_sql() -> str:
    buffer = StringIO()
    command.upgrade(_config(buffer), "head", sql=True)
    return buffer.getvalue()


def test_offline_upgrade_creates_users_and_tickets_tables() -> None:
    sql = _upgrade_sql()
    assert "CREATE TABLE users" in sql
    assert "CREATE TABLE tickets" in sql


def test_offline_upgrade_creates_ticket_sequence_starting_at_1061() -> None:
    sql = _upgrade_sql()
    assert "CREATE SEQUENCE ticket_number_seq START WITH 1061" in sql
    assert "nextval('ticket_number_seq')" in sql


def test_offline_upgrade_declares_check_constraints_and_pending_flag() -> None:
    sql = _upgrade_sql()
    assert "ck_tickets_status" in sql
    assert "'in_progress'" in sql
    assert "ck_users_role" in sql
    assert "awaiting_user BOOLEAN DEFAULT false NOT NULL" in sql


def test_revisions_form_a_linear_chain_ending_at_0002() -> None:
    script = ScriptDirectory.from_config(_config())
    assert script.get_heads() == ["0002"]
    assert script.get_revision("0002").down_revision == "0001"
    assert script.get_revision("0001").down_revision is None


def test_offline_upgrade_adds_user_area_and_realigns_demo_emails() -> None:
    sql = _upgrade_sql()
    assert "ALTER TABLE users ADD COLUMN area VARCHAR(80)" in sql
    assert "ana.ruiz@ejemplo.mx" in sql
    assert "luis.herrera@ejemplo.mx" in sql
    assert "sara.molina@ejemplo.mx" in sql
    assert "'Mesa de ayuda'" in sql


def test_offline_downgrade_of_0002_drops_the_area_column() -> None:
    buffer = StringIO()
    command.downgrade(_config(buffer), "0002:0001", sql=True)
    assert "ALTER TABLE users DROP COLUMN area" in buffer.getvalue()


def test_offline_downgrade_drops_tables_and_sequence() -> None:
    buffer = StringIO()
    command.downgrade(_config(buffer), "0001:base", sql=True)
    sql = buffer.getvalue()
    assert "DROP TABLE tickets" in sql
    assert "DROP TABLE users" in sql
    assert "DROP SEQUENCE ticket_number_seq" in sql
