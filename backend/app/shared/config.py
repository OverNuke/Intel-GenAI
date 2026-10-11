from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

_PSYCOPG_SCHEME = "postgresql+psycopg://"
_PLAIN_SCHEMES = ("postgresql://", "postgres://")

# Public on purpose: only used when VERCEL_ENV is unset (local dev and tests).
DEV_SESSION_SECRET = "ariadna-dev-only-secret"


class Settings(BaseSettings):
    """Runtime settings read from the environment. Nothing is required at import time."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str | None = None
    database_url_unpooled: str | None = None
    session_secret: str | None = None
    vercel_env: str | None = None  # set by Vercel (production | preview | development)
    # Assistant (any OpenAI-compatible endpoint). All optional: the fake adapter needs none.
    llm_base_url: str | None = None
    llm_model: str | None = None
    llm_api_key: str | None = None
    assistant_adapter: str | None = None  # "openai" | "fake"; unset = openai when fully configured
    llm_timeout_seconds: float = 20.0
    assistant_mode: str | None = None  # "single" | "agent"; anything else = single (ADR-0014)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def to_psycopg_url(url: str) -> str:
    """Rewrite postgres:// and postgresql:// to the psycopg 3 driver form, keeping the query."""
    for scheme in _PLAIN_SCHEMES:
        if url.startswith(scheme):
            return _PSYCOPG_SCHEME + url[len(scheme) :]
    return url


def migration_url(settings: Settings) -> str:
    """URL for Alembic and the seed: the unpooled one when set, else DATABASE_URL."""
    raw = settings.database_url_unpooled or settings.database_url
    if not raw:
        raise RuntimeError("DATABASE_URL (or DATABASE_URL_UNPOOLED) is not set")
    return to_psycopg_url(raw)


def on_vercel(settings: Settings) -> bool:
    return bool(settings.vercel_env)


def resolve_session_secret(settings: Settings) -> str:
    """Dev default off Vercel; on Vercel a missing secret fails on first use, not at import."""
    if settings.session_secret:
        return settings.session_secret
    if on_vercel(settings):
        raise RuntimeError("SESSION_SECRET is required when VERCEL_ENV is set")
    return DEV_SESSION_SECRET


def resolve_assistant_adapter(settings: Settings) -> Literal["openai", "fake"]:
    """openai only when requested (or unset) AND base url, model and key are all present."""
    requested = (settings.assistant_adapter or "").strip().lower()
    if requested not in ("", "openai"):
        return "fake"
    configured = all((settings.llm_base_url, settings.llm_model, settings.llm_api_key))
    return "openai" if configured else "fake"


def resolve_assistant_mode(settings: Settings) -> Literal["single", "agent"]:
    """The bounded tool loop is opt-in: only an explicit "agent" enables it."""
    return "agent" if (settings.assistant_mode or "").strip().lower() == "agent" else "single"
