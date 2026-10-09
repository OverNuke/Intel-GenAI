# Development phases (prototype scope)

Each phase ends with passing tests and conventional commits. Domain/use cases are test-first (ADR-0009). Backend = pytest, frontend = Vitest.

| Phase | Deliverable | Screens | Requirements |
|---|---|---|---|
| 0 Foundations | monorepo, Python tooling (uv/ruff/pytest/mypy), Neon schema + Alembic + seed (8 sample incidents + INC0001061), `vercel.json` | — | RNF-05 |
| 1 Access | tokens/atoms (minimum), demo auth, role guards | P1, A1–A4 | RF-01..04 |
| 2 User area | tickets and catalog | U1–U4 | RF-05..08 |
| 3 Ariadna (core value) | `AssistantPort`, OpenAI-compatible + fake adapters, conversation, "Tu solicitud", receipt, confirmed submit | U6, U7 | RF-10, RF-11, RNF-03/04 |
| 4 IT desk (minimal) | queue + record, "contactar → Pendiente" | T1, T2 | RF-12, RF-13 |
| 5 Supervisor | static sample metrics, measured vs estimated | S1 | RF-16 |
| 6 Publish | Vercel deploy (frontend + backend + Neon), README | — | RNF-05 |

**Deferred** (out of prototype scope): U5 Mi equipo (RF-09), T3 Cierre con Ariadna (RF-14), real T4 email delivery (RF-15; only the view), formal assistant evals, full a11y audit, Playwright E2E.

Current state: Phase 0 implemented, with two items unverified.

Done: monorepo split; backend settings/db engine, ticket and user models, hand-written Alembic migration (validated offline via `--sql`), deterministic seed (8 incidents + sequence at 1061), OpenAPI export; frontend app shell (theme switch, typed API client, dev proxy, ESLint), `gen:api` types. Tests, ruff, mypy, typecheck and lint are green.

Pending verification:
- Migration and seed have NOT been run against a live Neon database (the real-DB test is skipped without `DATABASE_URL`).
- The `vercel.json` backend service entrypoint (`app.main:app`) is unverified until a deploy (Phase 6).

Phase 1 (Access): implemented, automated checks green, manual verification pending.

Done: auth module (`/api/auth`: login by account or demo credentials, me, logout, access check, public accounts list), single domain authorization policy, signed session cookie, `users.area` + migration `0002_user_area`, typed client with `apiPost`, server-side guard (`requireAccess`), P1 landing, A1 sign-in with the A2 account picker as a state, A3 "Sin acceso", A4 "Sesión cerrada", minimal role shell and placeholder start pages.

Pending verification (manual, on a throwaway Neon branch only):
- Run `alembic upgrade head` (0002) and the seed; run the DB-gated tests; sign in through the picker.
- Confirm the dev rewrite passes `Set-Cookie` through to the browser.
- Confirm Vercel Deployment Protection does not break the server-side `/api/auth/access` fetch (`API_ORIGIN` may be needed).
- Confirm the A3 "Sin acceso" copy (inferred; the mock has no screen for it).

Known follow-up: TypeScript is pinned to `^6.0.3` until `typescript-eslint` supports TS 7.
