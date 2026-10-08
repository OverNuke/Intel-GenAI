# Ariadna

Ariadna is an AI web assistant that helps people prepare an IT request *before* submitting it (fewer misclassified tickets, missing data, wrong department). It is a deliberately small **prototype** for a fictional organization, with sample data only. UI copy is es-MX; code and docs are English.

Requirements, phases and ADRs live in `docs/`; the UX source of truth is `mock/Ariadna — prototipo.html`.

## Layout

```
frontend/   Next.js (App Router), UI only
backend/    FastAPI (uv), hexagonal by module; owns domain rules, LLM adapter, Postgres
vercel.json Vercel services: frontend + backend, /api/* -> backend
docs/       requirements, phases, ADRs
```

Each folder is installed and tested on its own.

## Quickstart

Backend (Python 3.12+, [uv](https://docs.astral.sh/uv/)):

```
cd backend
uv sync
uv run uvicorn app.main:app --reload --loop scripts.dev_loop:selector_loop_factory
uv run pytest
uv run ruff check . && uv run mypy
```

The `--loop` flag is needed on Windows (psycopg async cannot run on the default Proactor loop); it is harmless elsewhere.

Frontend (pnpm):

```
cd frontend
pnpm install
pnpm dev        # proxies /api/* to the backend in development
pnpm test
pnpm typecheck
pnpm lint
```

## Database

Postgres on Neon. Migrations and seed read `DATABASE_URL_UNPOOLED` and fall back to `DATABASE_URL`.

```
cd backend
uv run alembic upgrade head          # schema: users, tickets, ticket_number_seq starting at 1061
uv run python -m app.seed.run        # idempotent: 3 demo users + 8 sample incidents (INC0001053..1060)
```

The real-DB test (`tests/seed/test_seed_db.py`) is skipped unless `DATABASE_URL` is set. Point it **only at a throwaway Neon branch**: it runs migrations and seeds.

## API contract

FastAPI's OpenAPI is the source of truth; the frontend uses generated types.

```
cd backend && uv run python -m scripts.export_openapi   # writes backend/openapi.json
cd frontend && pnpm gen:api                              # writes src/lib/api-types.ts
```

## Environment variables

Set in `.env.local` / Vercel.

| Variable | Purpose | Used by code today |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** URL (app runtime) | yes |
| `DATABASE_URL_UNPOOLED` | Neon direct URL for Alembic/seed (optional; falls back to `DATABASE_URL`) | yes |
| `LLM_BASE_URL` | OpenAI-compatible endpoint | planned |
| `LLM_MODEL` | Model name | planned |
| `LLM_API_KEY` | Endpoint API key | planned |
| `SESSION_SECRET` | Signs the demo session cookie | planned |
| `ASSISTANT_ADAPTER` | `openai` or `fake` | planned |

## Status

See `docs/phases.md`.
