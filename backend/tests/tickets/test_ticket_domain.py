from dataclasses import FrozenInstanceError, fields
from datetime import UTC, datetime
from typing import get_args

import pytest
from sqlalchemy import CheckConstraint

from app.modules.auth.domain.user import Role, User
from app.modules.auth.infrastructure.models import UserRow
from app.modules.tickets.domain.ticket import (
    Impact,
    Priority,
    Ticket,
    TicketStatus,
    Urgency,
    format_ticket_id,
)
from app.modules.tickets.infrastructure.models import TicketRow, ticket_number_seq
from app.shared.db import Base


def test_format_ticket_id_pads_to_seven_digits() -> None:
    assert format_ticket_id(1061) == "INC0001061"
    assert format_ticket_id(1053) == "INC0001053"


def test_format_ticket_id_does_not_truncate_large_numbers() -> None:
    assert format_ticket_id(12345678) == "INC12345678"
    assert format_ticket_id(1) == "INC0000001"


def test_status_priority_impact_urgency_and_role_literals() -> None:
    assert get_args(TicketStatus) == ("new", "assigned", "in_progress", "resolved", "closed")
    assert get_args(Priority) == ("critical", "high", "medium", "low")
    assert get_args(Impact) == ("high", "medium", "low")
    assert get_args(Urgency) == ("high", "medium", "low")
    assert get_args(Role) == ("user", "it", "supervisor")


def _ticket() -> Ticket:
    now = datetime(2026, 1, 5, 9, 0, tzinfo=UTC)
    return Ticket(
        number=1053,
        summary="Sin red",
        description="No hay red en la oficina",
        service="network",
        status="new",
        awaiting_user=False,
        priority="high",
        impact="medium",
        urgency="high",
        assigned_group="Soporte TI",
        assignee_id=None,
        requester_id="ana",
        asset=None,
        via_ariadna=False,
        sla_due_at=None,
        created_at=now,
        updated_at=now,
    )


def test_ticket_is_a_frozen_value_with_display_id() -> None:
    ticket = _ticket()
    assert ticket.display_id == "INC0001053"
    with pytest.raises(FrozenInstanceError):
        ticket.summary = "otro"  # type: ignore[misc]


def test_user_is_frozen() -> None:
    user = User(
        id="ana", display_name="Ana Ruiz", email="ana.ruiz@ejemplo.mx", role="user", area="Finanzas"
    )
    assert user.role == "user"
    assert user.area == "Finanzas"
    with pytest.raises(FrozenInstanceError):
        user.role = "it"  # type: ignore[misc]


# Stored on the ticket row but modelled outside `Ticket`: the receipt lives on TicketRecord and
# the submission key is only an idempotency detail of the repository.
_ROW_ONLY_COLUMNS = {"ariadna_receipt", "submission_key"}


def test_ticket_fields_match_the_orm_columns() -> None:
    domain_fields = {f.name for f in fields(Ticket)}
    columns = {column.name for column in TicketRow.__table__.columns}
    assert domain_fields == columns - _ROW_ONLY_COLUMNS
    assert columns >= _ROW_ONLY_COLUMNS


def test_user_fields_match_the_orm_columns() -> None:
    assert {f.name for f in fields(User)} == {column.name for column in UserRow.__table__.columns}


def test_metadata_tables_are_users_tickets_events_and_participants() -> None:
    assert UserRow.__tablename__ == "users"
    assert set(Base.metadata.tables) == {"users", "tickets", "ticket_events", "ticket_participants"}


def test_ticket_event_columns_match_the_domain_event() -> None:
    from app.modules.tickets.domain.ticket import TicketEvent
    from app.modules.tickets.infrastructure.models import TicketEventRow

    columns = {column.name for column in TicketEventRow.__table__.columns}
    assert {f.name for f in fields(TicketEvent)} == columns
    assert TicketEventRow.__table__.c.ticket_number.foreign_keys


def test_ticket_number_sequence_starts_at_1061_and_is_the_pk_default() -> None:
    assert ticket_number_seq.name == "ticket_number_seq"
    assert ticket_number_seq.start == 1061
    number = TicketRow.__table__.c.number
    assert number.primary_key
    assert number.default is not None
    assert number.default.is_sequence


def test_check_constraints_cover_enumerated_columns() -> None:
    table = Base.metadata.tables["tickets"]
    checks = {str(c.sqltext) for c in table.constraints if isinstance(c, CheckConstraint)}
    assert len(checks) == 4
    joined = " ".join(checks)
    for column, values in (
        ("status", get_args(TicketStatus)),
        ("priority", get_args(Priority)),
        ("impact", get_args(Impact)),
        ("urgency", get_args(Urgency)),
    ):
        for value in values:
            assert f"'{value}'" in joined
        assert column in joined


def test_awaiting_user_defaults_to_false_and_requester_is_required() -> None:
    table = TicketRow.__table__
    assert table.c.awaiting_user.nullable is False
    assert table.c.awaiting_user.server_default is not None
    assert table.c.requester_id.nullable is False
    assert table.c.assignee_id.nullable is True


def test_event_kinds_include_assigned_the_reserved_note_and_the_confirmed_writes() -> None:
    from app.modules.tickets.domain.ticket import TicketEventKind

    assert get_args(TicketEventKind) == (
        "created",
        "assigned",
        "contact_requested",
        "note",
        "participants_added",
        "updated",
        "resolved",
        "closed",
    )


def test_ticket_event_and_record_are_frozen_values() -> None:
    from app.modules.tickets.domain.ticket import TicketEvent, TicketRecord, TicketView

    ticket = _ticket()
    event = TicketEvent(
        id="1053-1",
        ticket_number=1053,
        kind="created",
        author_id="ana",
        body=None,
        visible_to_requester=True,
        created_at=ticket.created_at,
    )
    record = TicketRecord(
        view=TicketView(ticket=ticket, requester_name="Ana Ruiz", assignee_name=None),
        events=(event,),
    )
    assert record.events[0].kind == "created"
    assert record.view.ticket.display_id == "INC0001053"
    with pytest.raises(FrozenInstanceError):
        event.kind = "note"  # type: ignore[misc]
