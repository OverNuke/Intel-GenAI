"""Test-only doubles for the auth ports (production adapters live in infrastructure/)."""

from collections.abc import Iterable

from app.modules.auth.domain.login import normalize_email
from app.modules.auth.domain.user import User
from app.seed.data import USERS


class InMemoryUserRepository:
    def __init__(self, users: Iterable[User] = USERS) -> None:
        self._users = {user.id: user for user in users}

    async def get(self, user_id: str) -> User | None:
        return self._users.get(user_id)

    async def list(self) -> list[User]:
        return list(self._users.values())

    async def find_by_email(self, email: str) -> User | None:
        wanted = normalize_email(email)
        return next((u for u in self._users.values() if normalize_email(u.email) == wanted), None)

    def replace(self, user: User) -> None:
        self._users[user.id] = user


class FakeSessionCodec:
    """Not signed: `issue` and `read` only agree on a visible prefix. Real signing: Batch 2."""

    PREFIX = "signed:"

    def issue(self, user_id: str) -> str:
        return f"{self.PREFIX}{user_id}"

    def read(self, token: str) -> str | None:
        return token.removeprefix(self.PREFIX) if token.startswith(self.PREFIX) else None
