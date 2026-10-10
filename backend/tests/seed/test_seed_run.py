from sqlalchemy.dialects.postgresql import Insert
from sqlalchemy.dialects.postgresql.psycopg import PGDialect_psycopg

from app.seed.data import TICKETS, USERS
from app.seed.run import build_statements, ticket_rows, user_rows


def _compile(statement: Insert) -> str:
    return str(statement.compile(dialect=PGDialect_psycopg()))  # type: ignore[no-untyped-call]


def test_statements_insert_users_before_tickets() -> None:
    users_stmt, tickets_stmt = build_statements()
    assert _compile(users_stmt).startswith("INSERT INTO users")
    assert _compile(tickets_stmt).startswith("INSERT INTO tickets")


def test_users_upsert_email_and_area_while_tickets_do_nothing_on_conflict() -> None:
    users_stmt, tickets_stmt = build_statements()
    users_sql, tickets_sql = _compile(users_stmt), _compile(tickets_stmt)
    assert "ON CONFLICT (id) DO UPDATE SET" in users_sql
    assert "email = excluded.email" in users_sql
    assert "area = excluded.area" in users_sql
    assert "ON CONFLICT (number) DO NOTHING" in tickets_sql


def test_user_rows_carry_email_and_area() -> None:
    rows = {row["id"]: row for row in user_rows()}
    assert rows["luis"]["email"] == "luis.herrera@ejemplo.mx"
    assert rows["luis"]["area"] == "Mesa de ayuda"
    assert rows["sara"]["area"] == "Supervisión"


def test_rows_carry_every_seed_record_with_explicit_ticket_numbers() -> None:
    users = user_rows()
    tickets = ticket_rows()
    assert [row["id"] for row in users] == [user.id for user in USERS]
    assert len(tickets) == len(TICKETS) == 8
    assert sorted(row["number"] for row in tickets) == list(range(1053, 1061))


def test_ticket_rows_map_domain_fields_to_columns() -> None:
    row = next(r for r in ticket_rows() if r["number"] == 1056)
    ticket = next(t for t in TICKETS if t.number == 1056)
    assert row["awaiting_user"] is True
    assert row["status"] == "in_progress"
    assert row["created_at"] == ticket.created_at
    assert row["requester_id"] == "ana"


def test_seed_never_touches_the_sequence() -> None:
    sql = " ".join(_compile(s).lower() for s in build_statements())
    assert "setval" not in sql
    assert "nextval" not in sql
