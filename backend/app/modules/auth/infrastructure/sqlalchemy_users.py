from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.auth.domain.login import normalize_email
from app.modules.auth.domain.user import Role, User
from app.modules.auth.infrastructure.models import UserRow


def _to_domain(row: UserRow) -> User:
    role: Role = row.role  # type: ignore[assignment]  # guarded by ck_users_role
    return User(
        id=row.id, display_name=row.display_name, email=row.email, role=role, area=row.area
    )


class SqlAlchemyUserRepository:
    """UserRepository over Postgres. One short session per call (serverless, NullPool)."""

    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self._sessions = sessions

    async def get(self, user_id: str) -> User | None:
        async with self._sessions() as session:
            row = await session.get(UserRow, user_id)
        return _to_domain(row) if row else None

    async def list(self) -> list[User]:
        async with self._sessions() as session:
            rows = (await session.scalars(select(UserRow).order_by(UserRow.display_name))).all()
        return [_to_domain(row) for row in rows]

    async def find_by_email(self, email: str) -> User | None:
        wanted = normalize_email(email)
        async with self._sessions() as session:
            row = await session.scalar(
                select(UserRow).where(func.lower(func.trim(UserRow.email)) == wanted)
            )
        return _to_domain(row) if row else None
