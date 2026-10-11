"""ticket_events, tickets.ariadna_receipt and tickets.submission_key

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ticket_events",
        # "{ticket number}-{seq}": the seed fixes it, the app takes the next seq in its transaction.
        sa.Column("id", sa.String(16), primary_key=True),
        sa.Column(
            "ticket_number",
            sa.Integer,
            sa.ForeignKey("tickets.number", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("author_id", sa.String(32), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column(
            "visible_to_requester", sa.Boolean, nullable=False, server_default=sa.true()
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "kind IN ('created', 'assigned', 'contact_requested', 'note')",
            name="ck_ticket_events_kind",
        ),
    )
    op.create_index(
        "ix_ticket_events_ticket_number_created_at",
        "ticket_events",
        ["ticket_number", "created_at"],
    )
    op.add_column("tickets", sa.Column("ariadna_receipt", postgresql.JSONB, nullable=True))
    op.add_column("tickets", sa.Column("submission_key", sa.String(64), nullable=True))
    op.create_unique_constraint("uq_tickets_submission_key", "tickets", ["submission_key"])


def downgrade() -> None:
    op.drop_constraint("uq_tickets_submission_key", "tickets", type_="unique")
    op.drop_column("tickets", "submission_key")
    op.drop_column("tickets", "ariadna_receipt")
    op.drop_index("ix_ticket_events_ticket_number_created_at", table_name="ticket_events")
    op.drop_table("ticket_events")
