from logging.config import fileConfig

from alembic import context

# Importing the models registers every table on Base.metadata.
import app.modules.auth.infrastructure.models
import app.modules.tickets.infrastructure.models  # noqa: F401
from app.shared.config import get_settings, migration_url
from app.shared.db import Base, sync_engine

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata

# `upgrade --sql` needs no database: render against a placeholder URL.
OFFLINE_URL = "postgresql+psycopg://offline/offline"


def run_migrations_offline() -> None:
    context.configure(
        url=OFFLINE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = sync_engine(migration_url(get_settings()))
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
