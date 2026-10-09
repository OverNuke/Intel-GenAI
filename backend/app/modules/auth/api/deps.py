from app.modules.auth.application.ports import SessionCodec, UserRepository
from app.modules.auth.infrastructure.session_codec import ItsDangerousSessionCodec
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
