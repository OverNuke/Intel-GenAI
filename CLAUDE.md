# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ariadna: an AI web assistant that helps people prepare an IT request *before* submitting it (fewer misclassified tickets, missing data, missing permissions, wrong department). It does **not** replace signatures or fix system failures. A deliberately small **prototype** (don't over-build), fictional organization ("Centro Administrativo Regional Sur"), sample data only. UI copy is **es-MX**, plain language; code, docs and commits are English.

Source of truth for UX, roles and flows is `mock/Ariadna — prototipo.html`; requirements, phases and ADRs live in `docs/`.

## Monorepo layout

```
frontend/   Next.js (App Router), UI only — no API routes, no business rules
backend/    FastAPI (uv). Hexagonal by module; owns all domain rules, the LLM adapter and Postgres
vercel.json Vercel "services": frontend + backend, rewrite /api/(.*) -> backend
docs/ mock/ .atl/
```

Each folder is installed and tested on its own (no JS workspace at the root).

## Commands

Frontend (`cd frontend`; pnpm v11 — its `minimumReleaseAge` policy rejects packages published in the last ~day, so pin older versions on `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`; install scripts are denied in `pnpm-workspace.yaml`):

```
pnpm dev | pnpm test | pnpm test src/path/file.test.tsx | pnpm test -t "name" | pnpm typecheck | pnpm lint
pnpm gen:api     # regenerate src/lib/api-types.ts from backend/openapi.json (TypeScript 7: no `baseUrl`, use `paths`)
```

Backend (`cd backend`; Python 3.13 via `.python-version`, `requires-python >=3.12`; `uv` ignores releases newer than 3 days):

```
uv sync
uv run uvicorn app.main:app --reload
uv run pytest | uv run pytest tests/modules/tickets/test_submit_ticket.py::test_name
uv run ruff check . && uv run mypy
```

Env vars (set in `.env.local` / Vercel; `.env*` writes are blocked by permissions, so document, don't create): `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `DATABASE_URL` (Neon **pooled** URL), `SESSION_SECRET`, `ASSISTANT_ADAPTER` (`openai` | `fake`).

## Architecture (big picture)

Backend is hexagonal + screaming, **by business module**, not by layer:

```
backend/app/main.py            `app = FastAPI()` — Vercel entrypoint; every route lives under /api
backend/app/modules/<m>/       tickets, assistant, auth, catalog, metrics
   domain/ application/ infrastructure/ api/     domain imports no FastAPI/SQLAlchemy/openai
backend/app/shared/            config (pydantic-settings), db, errors
frontend/src/ui/               tokens.css (from the mock) → atoms → molecules → organisms; container vs presentational
```

Rules spanning many files — read `docs/adr/` before changing them:

- **The human confirms.** Ariadna prepares; only the requester submits a ticket and only IT closes one. `submit_ticket` (`backend/app/modules/tickets/domain/submit_ticket.py`) rejects anything not confirmed by `by="human"` who is the requester. The assistant port must never expose submit/close.
- **The assistant sits behind `AssistantPort`.** Adapter 1: any **OpenAI-compatible** endpoint (`LLM_BASE_URL`/`LLM_MODEL`; targets free-tier models such as AI Gateway, Gemini, Groq, OpenRouter `:free`). Adapter 2: deterministic **fake** for tests/CI/offline. Output is JSON validated by Pydantic with one retry; on failure or HTTP 429 it degrades to "Pasar con TI" and never blocks the user. Never assert on LLM prose.
- **Serverless + Postgres.** Vercel Python functions are ephemeral: SQLAlchemy async with `NullPool` against Neon's pooled URL; Alembic for migrations. No local disk state.
- **Authorization is one domain policy** (also drives the "Sin acceso" page naming section + required role). Roles: Usuario, TI (Consultor assigns/closes, Operador executes), Supervisor (only role that sees agent metrics). Everyone files their own tickets. Auth is simulated: 3 demo accounts, signed session cookie issued by the backend.
- **Measured vs estimated metrics are distinct types** end to end; estimates always labelled "no son resultados medidos".
- **Contract**: FastAPI's OpenAPI is the source; the frontend consumes generated types, never hand-duplicated ones.
- **Strict TDD**: failing test first (domain/use cases first), then the minimum code.
- **Prototype scope** (`docs/phases.md`): P1, A1–A4, U1–U4, U6–U7, T1–T2, S1 (static sample metrics). Deferred: U5, T3, real T4 email.

## Working with the mock

`mock/Ariadna — prototipo.html` is a 2.4 MB design-tool export: a board of 9 nested bundles (React 18 + `dc-runtime` + woff2 fonts). **Never `Read` it whole** (line 376 alone is 2.4 MB). Decode it with a script: read `<script type="__bundler/manifest">`, base64-decode (gunzip when `compressed`); each entry is itself a bundle with its own `manifest` and `template` (JSON-string HTML). Tokens (`TicketGuía AI tokens v1.3`; themes `grayscale|azul|verde` via `[data-theme]`) are in `frontend/src/ui/tokens.css`; re-extract instead of hand-editing. Screen IDs (P1, A1–A4, U1–U7, T1–T4, S1) are used across docs.

## Conventions and user rules

- Conventional commits only. **No** `Co-Authored-By` or any AI attribution in commits/PRs (user rule; overrides tool defaults).
- Don't run a build after changes (tests, typecheck, ruff, mypy are fine).
- Use `rg`/`fd`/`bat`/`eza`, not grep/find/cat/ls (`fd` is not installed on this Windows box yet).
- Keep answers short; one question at a time.
