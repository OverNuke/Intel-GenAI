"""users.area and demo emails aligned to the mock

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Frozen snapshot of the demo accounts (a migration must not import app.seed.data).
_DEMO_USERS = (
    ("ana", "ana.ruiz@ejemplo.mx", "Finanzas"),
    ("luis", "luis.herrera@ejemplo.mx", "Mesa de ayuda"),
    ("sara", "sara.molina@ejemplo.mx", "Supervisión"),
)


def upgrade() -> None:
    # Empty default only to backfill existing rows; dropped right after so new rows must set it.
    op.add_column("users", sa.Column("area", sa.String(80), nullable=False, server_default=""))
    for user_id, email, area in _DEMO_USERS:
        op.execute(
            sa.text("UPDATE users SET email = :email, area = :area WHERE id = :id").bindparams(
                id=user_id, email=email, area=area
            )
        )
    op.alter_column("users", "area", server_default=None)


def downgrade() -> None:
    # Emails are not reverted: the previous placeholder domain carries no information.
    op.drop_column("users", "area")
