from typing import Any

import pytest

from app.shared.config import (
    DEV_SESSION_SECRET,
    Settings,
    get_settings,
    migration_url,
    on_vercel,
    resolve_assistant_adapter,
    resolve_session_secret,
    to_psycopg_url,
)


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL_UNPOOLED", raising=False)
    monkeypatch.delenv("SESSION_SECRET", raising=False)
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    for name in (
        "LLM_BASE_URL",
        "LLM_MODEL",
        "LLM_API_KEY",
        "ASSISTANT_ADAPTER",
        "LLM_TIMEOUT_SECONDS",
    ):
        monkeypatch.delenv(name, raising=False)
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


def _settings(**values: Any) -> Settings:
    return Settings(_env_file=None, **values)  # type: ignore[call-arg]


def test_settings_reads_session_secret_and_vercel_env_from_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SESSION_SECRET", "from-env")
    monkeypatch.setenv("VERCEL_ENV", "preview")
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.session_secret == "from-env"
    assert settings.vercel_env == "preview"


def test_secret_falls_back_to_the_dev_default_when_vercel_env_is_unset() -> None:
    assert resolve_session_secret(_settings()) == DEV_SESSION_SECRET


def test_explicit_secret_wins_outside_vercel_too() -> None:
    assert resolve_session_secret(_settings(session_secret="mine")) == "mine"


@pytest.mark.parametrize("env", ["production", "preview", "development"])
def test_secret_is_required_whenever_vercel_env_is_set(env: str) -> None:
    with pytest.raises(RuntimeError, match="SESSION_SECRET"):
        resolve_session_secret(_settings(vercel_env=env))
    assert resolve_session_secret(_settings(vercel_env=env, session_secret="s3cret")) == "s3cret"


def test_empty_secret_counts_as_missing_on_vercel() -> None:
    with pytest.raises(RuntimeError, match="SESSION_SECRET"):
        resolve_session_secret(_settings(vercel_env="production", session_secret=""))


def test_settings_construction_never_raises_for_a_missing_secret() -> None:
    assert _settings(vercel_env="production").session_secret is None


def test_on_vercel_is_true_for_any_vercel_env_value() -> None:
    assert on_vercel(_settings(vercel_env="production")) is True
    assert on_vercel(_settings(vercel_env="preview")) is True
    assert on_vercel(_settings()) is False
    assert on_vercel(_settings(vercel_env="")) is False


# --- assistant adapter selection (REQ-AC-4, S-AC-1)

_FULL = {"llm_base_url": "https://llm.example/v1", "llm_model": "m", "llm_api_key": "k"}


def test_llm_settings_default_to_nothing_and_a_20s_timeout() -> None:
    settings = _settings()
    assert settings.llm_base_url is None
    assert settings.llm_model is None
    assert settings.llm_api_key is None
    assert settings.assistant_adapter is None
    assert settings.llm_timeout_seconds == 20.0


def test_llm_settings_read_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_BASE_URL", "https://llm.example/v1")
    monkeypatch.setenv("LLM_MODEL", "gemini")
    monkeypatch.setenv("LLM_API_KEY", "secret")
    monkeypatch.setenv("ASSISTANT_ADAPTER", "openai")
    monkeypatch.setenv("LLM_TIMEOUT_SECONDS", "12.5")
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert (settings.llm_base_url, settings.llm_model, settings.llm_api_key) == (
        "https://llm.example/v1",
        "gemini",
        "secret",
    )
    assert settings.assistant_adapter == "openai"
    assert settings.llm_timeout_seconds == 12.5


def test_adapter_is_fake_when_nothing_is_configured() -> None:
    assert resolve_assistant_adapter(_settings()) == "fake"


def test_adapter_is_openai_when_unset_but_fully_configured() -> None:
    assert resolve_assistant_adapter(_settings(**_FULL)) == "openai"


def test_explicit_fake_wins_even_with_full_config() -> None:
    assert resolve_assistant_adapter(_settings(assistant_adapter="fake", **_FULL)) == "fake"


def test_openai_requested_without_the_key_falls_back_to_fake() -> None:
    incomplete = {"llm_base_url": "https://llm.example/v1", "llm_model": "m"}
    openai = _settings(assistant_adapter="openai", **incomplete)
    assert resolve_assistant_adapter(openai) == "fake"
    blank_key = _settings(assistant_adapter="openai", llm_api_key="")
    assert resolve_assistant_adapter(blank_key) == "fake"


def test_unknown_adapter_value_falls_back_to_fake() -> None:
    assert resolve_assistant_adapter(_settings(assistant_adapter="bogus", **_FULL)) == "fake"
