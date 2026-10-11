from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Request

from app.modules.auth.api.errors import NoSessionError, SectionDeniedError
from app.modules.auth.application.ports import SessionCodec, UserRepository
from app.modules.auth.application.use_cases import current_user
from app.modules.auth.domain.policy import Denied, authorize
from app.modules.auth.domain.user import User
from app.modules.auth.infrastructure.session_codec import ItsDangerousSessionCodec
from app.modules.auth.infrastructure.session_cookie import SESSION_COOKIE_NAME
from app.modules.auth.infrastructure.sqlalchemy_users import SqlAlchemyUserRepository
from app.shared.config import get_settings, on_vercel, resolve_session_secret
from app.shared.db import get_sessionmaker

# Composition root for the auth module. Tests replace these via app.dependency_overrides.


def get_user_repository() -> UserRepository:
    return SqlAlchemyUserRepository(get_sessionmaker())


def get_session_codec() -> SessionCodec:
    return ItsDangerousSessionCodec(resolve_session_secret(get_settings()))


def get_cookie_secure() -> bool:
    return on_vercel(get_settings())


async def get_current_user(
    request: Request,
    users: Annotated[UserRepository, Depends(get_user_repository)],
    codec: Annotated[SessionCodec, Depends(get_session_codec)],
) -> User:
    """The session user (role re-read from the repository), or 401 via NoSessionError."""
    user = await current_user(request.cookies.get(SESSION_COOKIE_NAME), users, codec)
    if user is None:
        raise NoSessionError
    return user


def require_section(section: str) -> Callable[..., Awaitable[User]]:
    """Dependency factory: the session user when the single policy opens `section`, else 401/403."""

    async def dependency(user: Annotated[User, Depends(get_current_user)]) -> User:
        decision = authorize(user.role, section)
        if isinstance(decision, Denied):
            raise SectionDeniedError(decision.section, decision.required_role)
        return user

    return dependency
