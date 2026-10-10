"""Default wiring of the auth dependencies (what main.py uses when nothing is overridden)."""

import pytest

from app.modules.auth.api.deps import get_cookie_secure, get_session_codec, get_user_repository
from app.modules.auth.infrastructure.sqlalchemy_users import SqlAlchemyUserRepository
from app.shared.config import DEV_SESSION_SECRET, get_settings
from app.shared.db import get_engine


@pytest.fixture(autouse=True)
def _clean(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("DATABASE_URL", "DATABASE_URL_UNPOOLED", "SESSION_SECRET", "VERCEL_ENV"):
        monkeypatch.delenv(name, raising=False)
    get_settings.cache_clear()
    get_engine.cache_clear()


def test_codec_uses_the_dev_secret_off_vercel() -> None:
    codec = get_session_codec()
    assert codec.read(codec.issue("ana")) == "ana"
    from app.modules.auth.infrastructure.session_codec import ItsDangerousSessionCodec

    assert ItsDangerousSessionCodec(DEV_SESSION_SECRET).read(codec.issue("luis")) == "luis"


def test_codec_uses_the_configured_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.auth.infrastructure.session_codec import ItsDangerousSessionCodec

    monkeypatch.setenv("SESSION_SECRET", "configured")
    get_settings.cache_clear()
    token = get_session_codec().issue("ana")
    assert ItsDangerousSessionCodec("configured").read(token) == "ana"
    assert ItsDangerousSessionCodec(DEV_SESSION_SECRET).read(token) is None


def test_codec_fails_on_first_use_when_on_vercel_without_a_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("VERCEL_ENV", "production")
    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="SESSION_SECRET"):
        get_session_codec()


def test_cookie_secure_follows_vercel_env(monkeypatch: pytest.MonkeyPatch) -> None:
    assert get_cookie_secure() is False
    monkeypatch.setenv("VERCEL_ENV", "preview")
    get_settings.cache_clear()
    assert get_cookie_secure() is True


def test_repository_is_the_sqlalchemy_one_and_does_not_connect(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@unreachable.invalid/db")
    get_settings.cache_clear()
    assert isinstance(get_user_repository(), SqlAlchemyUserRepository)
