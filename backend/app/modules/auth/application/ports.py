from typing import Protocol

from app.modules.auth.domain.user import User


class UserRepository(Protocol):
    async def get(self, user_id: str) -> User | None: ...

    async def list(self) -> list[User]: ...

    async def find_by_email(self, email: str) -> User | None:
        """Case-insensitive, surrounding whitespace ignored."""
        ...


class SessionCodec(Protocol):
    """Turns a user id into an opaque, tamper-evident token and back."""

    def issue(self, user_id: str) -> str: ...

    def read(self, token: str) -> str | None:
        """The user id, or None when the token is malformed, tampered with or expired."""
        ...
