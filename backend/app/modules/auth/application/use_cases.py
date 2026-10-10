from dataclasses import dataclass

from app.modules.auth.application.ports import SessionCodec, UserRepository
from app.modules.auth.domain.login import (
    AccountLogin,
    CredentialsLogin,
    FieldError,
    LoginInvalid,
    LoginRequest,
    is_demo_credentials,
    validate_login,
)
from app.modules.auth.domain.policy import Allowed, Denied, authorize
from app.modules.auth.domain.user import User

_INVALID_CREDENTIALS = (FieldError("form", "invalid_credentials"),)


@dataclass(frozen=True)
class LoginSuccess:
    user: User
    token: str


@dataclass(frozen=True)
class LoginFailure:
    errors: tuple[FieldError, ...]


@dataclass(frozen=True)
class AccessCheck:
    user: User
    decision: Allowed | Denied


async def _login_with_credentials(
    credentials: CredentialsLogin, users: UserRepository
) -> User | None:
    user = await users.find_by_email(credentials.email)
    # Always compare, even for unknown emails, so the answer does not depend on which part failed.
    matches = is_demo_credentials(credentials.email, credentials.password)
    return user if user is not None and matches else None


async def login(
    request: LoginRequest, users: UserRepository, codec: SessionCodec
) -> LoginSuccess | LoginFailure:
    validated = validate_login(request)
    if isinstance(validated, LoginInvalid):
        return LoginFailure(validated.errors)
    if isinstance(validated, AccountLogin):
        user = await users.find_by_email(validated.email)
        failure = LoginFailure((FieldError("email", "unknown_account"),))
    else:
        user = await _login_with_credentials(validated, users)
        failure = LoginFailure(_INVALID_CREDENTIALS)
    if user is None:
        return failure
    return LoginSuccess(user=user, token=codec.issue(user.id))


async def current_user(
    token: str | None, users: UserRepository, codec: SessionCodec
) -> User | None:
    """The role comes from the repository on every call, never from the token."""
    if not token:
        return None
    user_id = codec.read(token)
    if user_id is None:
        return None
    return await users.get(user_id)


async def check_access(
    token: str | None, section: str, users: UserRepository, codec: SessionCodec
) -> AccessCheck | None:
    """None means "no valid session" (the API answers 401)."""
    user = await current_user(token, users, codec)
    if user is None:
        return None
    return AccessCheck(user=user, decision=authorize(user.role, section))


async def list_accounts(users: UserRepository) -> list[User]:
    return await users.list()
