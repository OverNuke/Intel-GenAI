from typing import get_args

from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from app.modules.auth.domain.user import Role
from app.shared.db import Base, in_list


class UserRow(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint(in_list("role", get_args(Role)), name="ck_users_role"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    role: Mapped[str] = mapped_column(String(20))
    area: Mapped[str] = mapped_column(String(80))
