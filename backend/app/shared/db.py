from functools import lru_cache
from typing import Any

from sqlalchemy import Engine, create_engine
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.shared.config import get_settings, to_psycopg_url


class Base(DeclarativeBase):
    """Declarative base shared by every module's ORM models (infrastructure layer only)."""


def in_list(column: str, values: tuple[str, ...]) -> str:
    """SQL `column IN ('a', 'b')` for a CHECK built from a domain Literal."""
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def engine_options() -> dict[str, Any]:
    """Serverless-friendly options: no client pool (Neon pools) and no prepared statements."""
    return {"poolclass": NullPool, "connect_args": {"prepare_threshold": None}}


@lru_cache
def get_engine() -> AsyncEngine:
    """Lazy async engine. Building it never connects; it fails only if DATABASE_URL is unset."""
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return create_async_engine(to_psycopg_url(url), **engine_options())


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(bind=get_engine(), expire_on_commit=False)


def sync_engine(url: str) -> Engine:
    """Sync engine for Alembic and the seed runner (same options as the app engine)."""
    return create_engine(to_psycopg_url(url), **engine_options())
