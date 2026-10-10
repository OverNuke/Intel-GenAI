from datetime import datetime
from typing import get_args

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Sequence,
    String,
    Text,
    false,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.modules.tickets.domain.ticket import Impact, Priority, TicketStatus, Urgency
from app.shared.db import Base, in_list

# First generated id is 1061 (INC0001061): the seed inserts 1053..1060 explicitly.
TICKET_SEQUENCE_START = 1061
ticket_number_seq = Sequence(
    "ticket_number_seq", start=TICKET_SEQUENCE_START, metadata=Base.metadata
)


class TicketRow(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        CheckConstraint(in_list("status", get_args(TicketStatus)), name="ck_tickets_status"),
        CheckConstraint(in_list("priority", get_args(Priority)), name="ck_tickets_priority"),
        CheckConstraint(in_list("impact", get_args(Impact)), name="ck_tickets_impact"),
        CheckConstraint(in_list("urgency", get_args(Urgency)), name="ck_tickets_urgency"),
    )

    number: Mapped[int] = mapped_column(
        Integer,
        ticket_number_seq,
        server_default=ticket_number_seq.next_value(),
        primary_key=True,
        autoincrement=False,
    )
    summary: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    service: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20))
    awaiting_user: Mapped[bool] = mapped_column(Boolean, server_default=false())
    priority: Mapped[str] = mapped_column(String(20))
    impact: Mapped[str] = mapped_column(String(20))
    urgency: Mapped[str] = mapped_column(String(20))
    assigned_group: Mapped[str] = mapped_column(String(80))
    assignee_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    requester_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    asset: Mapped[str | None] = mapped_column(String(80))
    via_ariadna: Mapped[bool] = mapped_column(Boolean, server_default=false())
    sla_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
