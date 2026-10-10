"""Real-database test: reads the seeded `users` table (run alembic + seed on a throwaway Neon
branch first). Skipped unless DATABASE_URL is set; the suite never sets it."""

import os
from collections.abc import AsyncIterator

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from app.modules.auth.infrastructure.sqlalchemy_users import SqlAlchemyUserRepository
from app.seed.data import USERS
from app.shared.config import get_settings, to_psycopg_url
from app.shared.db import engine_options

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL is not set (real-DB test)"
)

ANA, LUIS, SARA = USERS


@pytest.fixture
async def repo() -> AsyncIterator[SqlAlchemyUserRepository]:
    get_settings.cache_clear()
    url = get_settings().database_url
    assert url
    engine: AsyncEngine = create_async_engine(to_psycopg_url(url), **engine_options())
    try:
        yield SqlAlchemyUserRepository(async_sessionmaker(bind=engine, expire_on_commit=False))
    finally:
        await engine.dispose()


async def test_get_maps_the_row_to_the_domain_user_with_area(
    repo: SqlAlchemyUserRepository,
) -> None:
    assert await repo.get("luis") == LUIS
    assert await repo.get("sara") == SARA


async def test_get_unknown_id_is_none(repo: SqlAlchemyUserRepository) -> None:
    assert await repo.get("ghost") is None


async def test_list_returns_the_three_seeded_users(repo: SqlAlchemyUserRepository) -> None:
    assert await repo.list() == list(USERS)


async def test_find_by_email_ignores_case_and_surrounding_whitespace(
    repo: SqlAlchemyUserRepository,
) -> None:
    assert await repo.find_by_email("  ANA.Ruiz@Ejemplo.MX ") == ANA
    assert await repo.find_by_email("luis.herrera@ejemplo.mx") == LUIS


async def test_find_by_email_unknown_is_none(repo: SqlAlchemyUserRepository) -> None:
    assert await repo.find_by_email("nadie@ejemplo.mx") is None
