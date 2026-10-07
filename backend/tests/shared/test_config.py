import pytest

from app.shared.config import Settings, get_settings, migration_url, to_psycopg_url


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL_UNPOOLED", raising=False)
    get_settings.cache_clear()


def test_settings_reads_database_url_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@h/db")
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.database_url == "postgresql://u:p@h/db"
    assert settings.database_url_unpooled is None


def test_settings_without_env_has_no_urls() -> None:
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.database_url is None
    assert settings.database_url_unpooled is None


def test_get_settings_is_lazy_and_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@h/one")
    first = get_settings()
    assert first.database_url == "postgresql://u:p@h/one"
    assert get_settings() is first


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("postgresql://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
        ("postgres://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
        (
            "postgresql://u:p@h/db?sslmode=require",
            "postgresql+psycopg://u:p@h/db?sslmode=require",
        ),
        ("postgresql+psycopg://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
    ],
)
def test_to_psycopg_url(raw: str, expected: str) -> None:
    assert to_psycopg_url(raw) == expected


def test_migration_url_falls_back_to_database_url() -> None:
    settings = Settings(_env_file=None, database_url="postgresql://u:p@pooled/db")  # type: ignore[call-arg]
    assert migration_url(settings) == "postgresql+psycopg://u:p@pooled/db"


def test_migration_url_prefers_unpooled() -> None:
    settings = Settings(  # type: ignore[call-arg]
        _env_file=None,
        database_url="postgresql://u:p@pooled/db",
        database_url_unpooled="postgres://u:p@direct/db?sslmode=require",
    )
    assert migration_url(settings) == "postgresql+psycopg://u:p@direct/db?sslmode=require"


def test_migration_url_without_any_url_raises() -> None:
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        migration_url(Settings(_env_file=None))  # type: ignore[call-arg]
