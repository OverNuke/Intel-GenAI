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

Phase 1 adds migration `0002_user_area` (a `users.area` column). On a database that already ran `0001`, apply it and re-run the seed so the users get their area (the seed upserts email/area; it never calls `setval`):

```
cd backend
uv run alembic upgrade head          # applies 0002_user_area
uv run python -m app.seed.run        # idempotent: refreshes the 3 demo users
```

> Run migrations, the seed and the real-DB tests **only against a throwaway Neon branch** until the Phase 1 flow has been verified by hand.

The real-DB tests (`tests/seed/test_seed_db.py`, `tests/modules/auth/test_sqlalchemy_users.py`) are skipped unless `DATABASE_URL` is set. Point them **only at a throwaway Neon branch**: they run migrations and seed.

## Docker

Local-only stack (Docker Desktop, Compose v2): Postgres 17 + migrate/seed + backend + frontend, fully isolated from Neon and from host `.env*` files (nothing is read via `env_file`; `ASSISTANT_ADAPTER=fake`). Not used for Vercel deploys.

The local Postgres password is not committed. Before the first run, create a gitignored `.env` next to `compose.yaml` with a URL-safe value (letters and digits):

```
POSTGRES_PASSWORD=<choose-one>
```

Compose reads that file only to interpolate `compose.yaml`; it is never passed to a container, and Compose fails fast if the variable is missing. Vercel and Neon keep their own `DATABASE_URL*` and never touch this file.

```
docker compose up --build            # then open http://localhost:3000
docker compose down -v               # stop and reset the database volume
```

- Startup order: `db` healthy, `migrate` (alembic + idempotent seed) exits 0, `backend` healthy, `frontend`.
- There are no bind mounts and no hot reload: re-run with `--build` to pick up code changes.
- The frontend reaches the backend through `API_ORIGIN=http://backend:8000` (dev rewrite of `/api`).

Run both test suites (pytest against a fresh throwaway Postgres, so DB-gated tests run instead of skipping, and vitest):

```
docker compose --profile test up --build --exit-code-from tests tests
```

The command prints both outputs and exits non-zero if either suite fails; a failing backend suite does not stop vitest. If your Compose version aborts early because of `--exit-code-from`, use the fallback:

```
docker compose --profile test run --rm --build tests
docker compose --profile test down
```

Commands above are PowerShell-safe (no `&&`). The Postgres major (17) is a pin of this setup; align it with your Neon project if it differs.

## Neon resources (human-only, ADR-0013)

`neon.ts` declares a private `uploads` bucket. Run these steps yourself, in order; the agent never runs them:

1. `neon link` to the Marketplace project on a **child branch** (not `main`); confirm the flags with `neon link --help` first. Never copy a returned URL into `.env*`.
2. `neon config plan` and read the diff: it must only add the `uploads` bucket (**Gate**).
3. Push the branch and check the Vercel preview build: `frontend` and `backend` still build and nothing picks the root `package.json` as a project.
4. `neon deploy` (alias of `neon config apply`). It may not be reversible.
5. Check `.env`, `.env.local` and `backend/.env`: no production `DATABASE_URL` landed there, and `git status` shows no untracked `.env*`.

The root `package.json` is a single-dependency toolchain file (`@neon/config`), not a JS workspace. Review the files that `neon skills` and `neon mcp` write (`git status` and user-global config) before committing them. Keep a production URL out of `backend/.env`: DB-gated tests would skip while Alembic and the seed would hit production.

## Demo accounts (Phase 1)

Sign-in is simulated. The backend issues a signed `ariadna_session` cookie (HttpOnly, SameSite=Lax, 8 h). Use "Entrar con la cuenta de la organización" to pick an account, or the form with the one demo credential.

| Account | Area | Role | Opens |
|---|---|---|---|
| ana.ruiz@ejemplo.mx | Finanzas | Usuario | `/inicio` |
| luis.herrera@ejemplo.mx | Mesa de ayuda | TI | `/ti/seguimiento` |
| sara.molina@ejemplo.mx | Supervisión | Supervisor | `/supervisor/agente` |

Credentials form: `ana.ruiz@ejemplo.mx` / `demo2026` (Ana only; the other accounts use the picker). Opening a section the role may not see shows "Sin acceso" (`/sin-acceso`); no session redirects to `/entrar`; "Cerrar sesión" ends at `/sesion-cerrada`.

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
| `LLM_BASE_URL` | OpenAI-compatible endpoint (e.g. AI Gateway, Gemini, Groq, OpenRouter `:free`) | yes |
| `LLM_MODEL` | Model name | yes |
| `LLM_API_KEY` | Endpoint API key. Never required: without it the deterministic fake adapter answers | yes |
| `LLM_TIMEOUT_SECONDS` | Per-request timeout of the LLM call (default `20`; keep it below the platform function limit) | yes |
| `SESSION_SECRET` | Signs the demo session cookie. Optional locally (public dev default when `VERCEL_ENV` is unset); **required on Vercel** (the first use raises if missing) | yes |
| `API_ORIGIN` | Absolute backend origin (e.g. `https://my-app.vercel.app`) used by Next **server components** to call `/api/auth/access` (Node `fetch` needs an absolute URL). Optional: falls back to `http://127.0.0.1:8000` outside production and to the request's own origin (`x-forwarded-proto` + host) in production. Outside production it is also the target of the dev `/api` rewrite (the Docker stack sets it to `http://backend:8000`) | yes |
| `ASSISTANT_MODE` | `single` (default) or `agent`. `agent` lets Ariadna run a bounded loop of read-only checks (catalog, required data, your similar tickets, people by name, permissions) and *propose* actions that you confirm; any other value means `single`. Document only: set it in `.env.local` / Vercel | yes |
| `ASSISTANT_ADAPTER` | `openai` or `fake`. Unset = `openai` only when `LLM_BASE_URL`, `LLM_MODEL` and `LLM_API_KEY` are all set, otherwise `fake` (a missing key never fails the app) | yes |

## Status

See `docs/phases.md`.
