"""initial schema: users, tickets, ticket_number_seq

Revision ID: 0001
Revises:
Create Date: 2026-10-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # First generated id is 1061 (INC0001061); the seed inserts 1053..1060 explicitly.
    op.execute(sa.schema.CreateSequence(sa.Sequence("ticket_number_seq", start=1061)))

    op.create_table(
        "users",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("role", sa.String(20), nullable=False),
        sa.CheckConstraint("role IN ('user', 'it', 'supervisor')", name="ck_users_role"),
    )

    op.create_table(
        "tickets",
        sa.Column(
            "number",
            sa.Integer,
            primary_key=True,
            autoincrement=False,
            server_default=sa.text("nextval('ticket_number_seq')"),
        ),
        sa.Column("summary", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("service", sa.String(40), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("awaiting_user", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("priority", sa.String(20), nullable=False),
        sa.Column("impact", sa.String(20), nullable=False),
        sa.Column("urgency", sa.String(20), nullable=False),
        sa.Column("assigned_group", sa.String(80), nullable=False),
        sa.Column("assignee_id", sa.String(32), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("requester_id", sa.String(32), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("asset", sa.String(80), nullable=True),
        sa.Column("via_ariadna", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("sla_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('new', 'assigned', 'in_progress', 'resolved', 'closed')",
            name="ck_tickets_status",
        ),
        sa.CheckConstraint(
            "priority IN ('critical', 'high', 'medium', 'low')", name="ck_tickets_priority"
        ),
        sa.CheckConstraint("impact IN ('high', 'medium', 'low')", name="ck_tickets_impact"),
        sa.CheckConstraint("urgency IN ('high', 'medium', 'low')", name="ck_tickets_urgency"),
    )


def downgrade() -> None:
    op.drop_table("tickets")
    op.drop_table("users")
    op.execute(sa.schema.DropSequence(sa.Sequence("ticket_number_seq")))
