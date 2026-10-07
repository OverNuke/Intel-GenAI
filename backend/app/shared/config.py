from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

_PSYCOPG_SCHEME = "postgresql+psycopg://"
_PLAIN_SCHEMES = ("postgresql://", "postgres://")


class Settings(BaseSettings):
    """Runtime settings read from the environment. Nothing is required at import time."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str | None = None
    database_url_unpooled: str | None = None


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
