"""ticket_participants and the write event kinds

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_OLD_KINDS = "'created', 'assigned', 'contact_requested', 'note'"
_NEW_KINDS = f"{_OLD_KINDS}, 'participants_added', 'updated', 'resolved', 'closed'"


def upgrade() -> None:
    op.create_table(
        "ticket_participants",
        sa.Column(
            "ticket_number",
            sa.Integer,
            sa.ForeignKey("tickets.number", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("added_by", sa.String(32), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("ticket_number", "user_id"),
    )
    op.drop_constraint("ck_ticket_events_kind", "ticket_events", type_="check")
    op.create_check_constraint("ck_ticket_events_kind", "ticket_events", f"kind IN ({_NEW_KINDS})")


def downgrade() -> None:
    # Events of the new kinds would violate the restored constraint.
    op.execute(f"DELETE FROM ticket_events WHERE kind NOT IN ({_OLD_KINDS})")
    op.drop_constraint("ck_ticket_events_kind", "ticket_events", type_="check")
    op.create_check_constraint("ck_ticket_events_kind", "ticket_events", f"kind IN ({_OLD_KINDS})")
    op.drop_table("ticket_participants")
