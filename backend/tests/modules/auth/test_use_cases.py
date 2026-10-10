from dataclasses import replace

import pytest

from app.modules.auth.application.use_cases import (
    AccessCheck,
    LoginFailure,
    LoginSuccess,
    check_access,
    current_user,
    list_accounts,
    login,
)
from app.modules.auth.domain.login import FieldError, LoginRequest
from app.modules.auth.domain.policy import Allowed, Denied
from app.modules.auth.domain.user import User
from app.seed.data import USERS
from tests.modules.auth.fakes import FakeSessionCodec, InMemoryUserRepository

ANA, LUIS, SARA = USERS


@pytest.fixture
def users() -> InMemoryUserRepository:
    return InMemoryUserRepository()


@pytest.fixture
def codec() -> FakeSessionCodec:
    return FakeSessionCodec()


def _account(email: str) -> LoginRequest:
    return LoginRequest(method="account", email=email)


def _credentials(email: str, password: str) -> LoginRequest:
    return LoginRequest(method="credentials", email=email, password=password)


# --- login: account selection (S-DS-1, S-DS-2, S-DS-9)


@pytest.mark.parametrize("user", USERS)
async def test_account_login_signs_in_each_demo_account(
    user: User, users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    result = await login(_account(user.email), users, codec)
    assert result == LoginSuccess(user=user, token=codec.issue(user.id))


async def test_account_login_with_unknown_account_fails_without_a_token(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    result = await login(_account("mallory@ejemplo.mx"), users, codec)
    assert result == LoginFailure((FieldError("email", "unknown_account"),))


async def test_account_login_normalizes_the_email(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    result = await login(_account(" LUIS.Herrera@Ejemplo.MX "), users, codec)
    assert result == LoginSuccess(user=LUIS, token=codec.issue("luis"))


# --- login: credentials (S-DS-3, S-DS-4, S-DS-5)


async def test_credentials_login_succeeds_for_ana_with_messy_email(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    result = await login(_credentials("  ANA.Ruiz@Ejemplo.MX ", "demo2026"), users, codec)
    assert result == LoginSuccess(user=ANA, token=codec.issue("ana"))


async def test_credentials_login_rejects_wrong_password_generically(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    result = await login(_credentials("ana.ruiz@ejemplo.mx", "wrong"), users, codec)
    assert result == LoginFailure((FieldError("form", "invalid_credentials"),))


async def test_credentials_login_is_ana_only_even_with_the_right_password(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    result = await login(_credentials("luis.herrera@ejemplo.mx", "demo2026"), users, codec)
    assert result == LoginFailure((FieldError("form", "invalid_credentials"),))


async def test_unknown_email_and_wrong_password_fail_with_the_same_error(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    unknown = await login(_credentials("nadie@ejemplo.mx", "demo2026"), users, codec)
    wrong = await login(_credentials("ana.ruiz@ejemplo.mx", "nope"), users, codec)
    assert unknown == wrong == LoginFailure((FieldError("form", "invalid_credentials"),))


async def test_non_ascii_password_does_not_crash_the_comparison(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    result = await login(_credentials("ana.ruiz@ejemplo.mx", "contraseña"), users, codec)
    assert result == LoginFailure((FieldError("form", "invalid_credentials"),))


async def test_ana_is_resolved_through_the_repository_not_hardcoded(
    codec: FakeSessionCodec,
) -> None:
    empty = InMemoryUserRepository(users=[LUIS, SARA])
    result = await login(_credentials("ana.ruiz@ejemplo.mx", "demo2026"), empty, codec)
    assert result == LoginFailure((FieldError("form", "invalid_credentials"),))


async def test_validation_errors_are_returned_before_any_lookup(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    result = await login(LoginRequest(method="credentials"), users, codec)
    assert result == LoginFailure(
        (FieldError("email", "required"), FieldError("password", "required"))
    )


# --- current_user (S-DS-6/7 at the use-case level, REQ-DS-8)


async def test_current_user_resolves_the_user_from_a_valid_token(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    assert await current_user(codec.issue("sara"), users, codec) == SARA


@pytest.mark.parametrize("token", [None, "", "garbage", "signed:"])
async def test_current_user_is_none_for_missing_or_unreadable_tokens(
    token: str | None, users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    assert await current_user(token, users, codec) is None


async def test_current_user_is_none_when_the_account_no_longer_exists(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    assert await current_user(codec.issue("ghost"), users, codec) is None


async def test_current_user_takes_the_role_from_the_repository_not_the_token(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    token = codec.issue("ana")
    users.replace(replace(ANA, role="supervisor"))
    user = await current_user(token, users, codec)
    assert user is not None
    assert user.role == "supervisor"


# --- check_access (S-RA-6, S-RA-7)


async def test_check_access_without_session_is_none(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    assert await check_access(None, "ticket-tracking", users, codec) is None


async def test_check_access_denies_supervisor_from_ticket_tracking(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    result = await check_access(codec.issue("sara"), "ticket-tracking", users, codec)
    assert result == AccessCheck(
        user=SARA, decision=Denied(section="ticket-tracking", required_role="it")
    )


async def test_check_access_allows_it_into_ticket_tracking(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    result = await check_access(codec.issue("luis"), "ticket-tracking", users, codec)
    assert result == AccessCheck(user=LUIS, decision=Allowed())


async def test_check_access_denies_unknown_section_fail_closed(
    users: InMemoryUserRepository, codec: FakeSessionCodec
) -> None:
    result = await check_access(codec.issue("luis"), "nonexistent", users, codec)
    assert result == AccessCheck(user=LUIS, decision=Denied("nonexistent", None))


# --- list_accounts (picker)


async def test_list_accounts_returns_the_three_demo_users_in_seed_order(
    users: InMemoryUserRepository,
) -> None:
    assert await list_accounts(users) == list(USERS)
