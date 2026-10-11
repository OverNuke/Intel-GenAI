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


def test_revisions_form_a_linear_chain_ending_at_0003() -> None:
    script = ScriptDirectory.from_config(_config())
    assert script.get_heads() == ["0003"]
    assert script.get_revision("0003").down_revision == "0002"
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


def test_offline_upgrade_creates_ticket_events_with_kind_check_and_index() -> None:
    sql = _upgrade_sql()
    assert "CREATE TABLE ticket_events" in sql
    assert "id VARCHAR(16) NOT NULL" in sql
    assert "ck_ticket_events_kind" in sql
    for kind in ("'created'", "'assigned'", "'contact_requested'", "'note'"):
        assert kind in sql
    assert "ON DELETE CASCADE" in sql
    assert "CREATE INDEX ix_ticket_events_ticket_number_created_at" in sql


def test_offline_upgrade_adds_the_receipt_and_submission_key_columns() -> None:
    sql = _upgrade_sql()
    assert "ALTER TABLE tickets ADD COLUMN ariadna_receipt JSONB" in sql
    assert "ALTER TABLE tickets ADD COLUMN submission_key VARCHAR(64)" in sql
    assert "uq_tickets_submission_key" in sql


def test_offline_downgrade_of_0003_removes_events_receipt_and_key() -> None:
    buffer = StringIO()
    command.downgrade(_config(buffer), "0003:0002", sql=True)
    sql = buffer.getvalue()
    assert "DROP TABLE ticket_events" in sql
    assert "ALTER TABLE tickets DROP COLUMN ariadna_receipt" in sql
    assert "ALTER TABLE tickets DROP COLUMN submission_key" in sql
    # 0002 state remains: the users.area column is untouched by this downgrade.
    assert "DROP COLUMN area" not in sql
