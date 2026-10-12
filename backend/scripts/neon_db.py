"""Run migrations / seed against a Neon database and check its state.

    uv run python -m scripts.neon_db status              # read-only diagnosis
    uv run python -m scripts.neon_db migrate             # alembic upgrade head
    uv run python -m scripts.neon_db migrate --seed      # ...and the idempotent demo seed

The target is DATABASE_URL_UNPOOLED, else DATABASE_URL (shell env or backend/.env). If neither is
set you are prompted, with hidden input, so the secret never lands in shell history. The target
host is always printed and `migrate` asks for confirmation (skip with --yes).
"""

import argparse
import getpass
import os
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import TYPE_CHECKING
from urllib.parse import urlsplit

if TYPE_CHECKING:
    from alembic.config import Config

BACKEND = Path(__file__).resolve().parents[1]


def pick_url(env: Mapping[str, str | None]) -> str | None:
    """Same precedence as `migration_url`: unpooled first (Alembic needs session state)."""
    return env.get("DATABASE_URL_UNPOOLED") or env.get("DATABASE_URL") or None


def describe_target(url: str) -> str:
    """host/db only, never credentials; flags the pgbouncer host."""
    parts = urlsplit(url)
    host = parts.hostname or "?"
    label = f"{host}{parts.path}"
    return f"{label} (POOLED)" if "-pooler" in host else label


def _resolve_url(*, force_prompt: bool = False) -> str:
    from app.shared.config import get_settings

    if not force_prompt:
        settings = get_settings()
        url = pick_url(
            {
                "DATABASE_URL_UNPOOLED": settings.database_url_unpooled,
                "DATABASE_URL": settings.database_url,
            }
        )
        if url:
            return url
    url = getpass.getpass("Neon connection string (hidden input): ").strip()
    if not url:
        sys.exit("No connection string given.")
    # Env vars outrank backend/.env in pydantic-settings, so this wins over any stale value.
    os.environ.pop("DATABASE_URL", None)
    os.environ["DATABASE_URL_UNPOOLED"] = url
    get_settings.cache_clear()
    return url


def _alembic_config() -> "Config":
    from alembic.config import Config

    return Config(str(BACKEND / "alembic.ini"))


def status(url: str) -> bool:
    """Print revision, tables and demo accounts. Returns True when the schema is at head."""
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory
    from sqlalchemy import inspect, text

    from app.shared.config import get_settings, migration_url
    from app.shared.db import sync_engine

    head = ScriptDirectory.from_config(_alembic_config()).get_current_head()
    engine = sync_engine(migration_url(get_settings()))
    try:
        with engine.connect() as conn:
            current = MigrationContext.configure(conn).get_current_revision()
            tables = set(inspect(conn).get_table_names())
            emails: list[str] = []
            tickets = None
            if "users" in tables:
                emails = [r[0] for r in conn.execute(text("select email from users order by 1"))]
            if "tickets" in tables:
                tickets = conn.execute(text("select count(*) from tickets")).scalar()
    finally:
        engine.dispose()

    at_head = current == head
    print(f"target   : {describe_target(url)}")
    print(f"revision : {current or '(none)'}  head: {head}  -> {'OK' if at_head else 'BEHIND'}")
    print(f"tables   : {', '.join(sorted(tables)) or '(empty database)'}")
    print(f"users    : {len(emails)} {emails}")
    print(f"tickets  : {tickets if tickets is not None else '(no table)'}")
    if at_head and not emails:
        print("hint     : schema is current but empty -> run `migrate --seed`")
    return at_head


def migrate(url: str, *, seed: bool, assume_yes: bool) -> None:
    from alembic import command

    from app.shared.config import get_settings, migration_url

    print(f"About to run `alembic upgrade head`{' + seed' if seed else ''} on:")
    print(f"  {describe_target(url)}")
    if not assume_yes and input("Type 'yes' to continue: ").strip().lower() != "yes":
        sys.exit("Aborted.")

    command.upgrade(_alembic_config(), "head")
    if seed:
        from app.seed.run import run

        run(migration_url(get_settings()))
        print("seed: done (idempotent)")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--prompt", action="store_true", help="ignore env vars / .env and ask for the URL"
    )
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status", parents=[common], help="read-only: revision, tables, demo accounts")
    mig = sub.add_parser("migrate", parents=[common], help="alembic upgrade head")
    mig.add_argument("--seed", action="store_true", help="also run the idempotent demo seed")
    mig.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    args = parser.parse_args(argv)

    os.chdir(BACKEND)  # alembic.ini / .env are resolved from backend/
    sys.path.insert(0, str(BACKEND))
    url = _resolve_url(force_prompt=args.prompt)
    if args.cmd == "migrate":
        migrate(url, seed=args.seed, assume_yes=args.yes)
    sys.exit(0 if status(url) else 1)


if __name__ == "__main__":
    main()
