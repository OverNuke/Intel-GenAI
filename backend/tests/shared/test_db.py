import importlib
import sys

import pytest
from sqlalchemy.pool import NullPool

from app.shared.config import get_settings
from app.shared.db import engine_options, get_engine, get_sessionmaker, sync_engine


@pytest.fixture(autouse=True)
def _clean(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL_UNPOOLED", raising=False)
    get_settings.cache_clear()
    get_engine.cache_clear()


def test_engine_options_disable_prepared_statements_and_pooling() -> None:
    options = engine_options()
    assert options["poolclass"] is NullPool
    assert options["connect_args"] == {"prepare_threshold": None}


def test_get_engine_is_async_psycopg_nullpool_without_connecting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Host does not resolve: any I/O at creation time would raise.
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@unreachable.invalid/db?sslmode=require")
    get_settings.cache_clear()
    engine = get_engine()
    assert engine.url.drivername == "postgresql+psycopg"
    assert engine.url.query == {"sslmode": "require"}
    assert isinstance(engine.sync_engine.pool, NullPool)
    assert get_engine() is engine


def test_get_engine_without_database_url_fails_explicitly() -> None:
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        get_engine()


def test_get_sessionmaker_is_bound_to_the_lazy_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgres://u:p@unreachable.invalid/db")
    get_settings.cache_clear()
    factory = get_sessionmaker()
    assert factory.kw["bind"] is get_engine()


def test_sync_engine_uses_psycopg_nullpool_without_connecting() -> None:
    engine = sync_engine("postgres://u:p@unreachable.invalid/db")
    assert engine.url.drivername == "postgresql+psycopg"
    assert isinstance(engine.pool, NullPool)


def test_app_main_imports_without_database_url() -> None:
    sys.modules.pop("app.main", None)
    module = importlib.import_module("app.main")
    assert module.app.title == "Ariadna API"
