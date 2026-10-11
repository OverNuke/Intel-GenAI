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
| 7 Ticket resolution *(future)* | T3 "Cierre con Ariadna": IT writes the resolution and presses "Cerrar ticket"; resolved/closed ticket view for the requester (U3 closed state); T2 gains the remaining actions (take, note, mark resolved) and clears "Pendiente" | T3 (+ U3, T2 deltas) | RF-13, RF-14 |

**Deferred** (out of prototype scope): U5 Mi equipo (RF-09), real T4 email delivery (RF-15; only the view), formal assistant evals, full a11y audit, Playwright E2E. T3 Cierre con Ariadna (RF-14) is no longer dropped: it is planned as Phase 7, after the first publish.

Phase 7 notes: only IT closes a ticket (ADR-0003, the human confirms); Ariadna prepares the closing checklist and never closes. Depends on `ticket_events` (migration 0003 of phases 2–5) and on the `awaiting_user` flag from T2.

Current state: Phase 0 implemented, with two items unverified.

Done: monorepo split; backend settings/db engine, ticket and user models, hand-written Alembic migration (validated offline via `--sql`), deterministic seed (8 incidents + sequence at 1061), OpenAPI export; frontend app shell (theme switch, typed API client, dev proxy, ESLint), `gen:api` types. Tests, ruff, mypy, typecheck and lint are green.

Pending verification:
- Migration and seed have NOT been run against a live Neon database (the real-DB test is skipped without `DATABASE_URL`).
- The `vercel.json` backend service entrypoint (`app.main:app`) is unverified until a deploy (Phase 6).

Phase 1 (Access): implemented, automated checks green, manual verification pending.

Done: auth module (`/api/auth`: login by account or demo credentials, me, logout, access check, public accounts list), single domain authorization policy, signed session cookie, `users.area` + migration `0002_user_area`, typed client with `apiPost`, server-side guard (`requireAccess`), P1 landing, A1 sign-in with the A2 account picker as a state, A3 "Sin acceso", A4 "Sesión cerrada", minimal role shell (its placeholder start pages were replaced by the real screens in phases 2–5).

Pending verification (manual, on a throwaway Neon branch only):
- Run `alembic upgrade head` (0002) and the seed; run the DB-gated tests; sign in through the picker.
- Confirm the dev rewrite passes `Set-Cookie` through to the browser.
- Confirm Vercel Deployment Protection does not break the server-side `/api/auth/access` fetch (`API_ORIGIN` may be needed).
- Confirm the A3 "Sin acceso" copy (inferred; the mock has no screen for it).

Phases 2–5 (user area, Ariadna, IT desk, Supervisor): implemented in one change, automated checks green, manual verification pending. Phase 7 (T3 closing) is NOT implemented.

Done:
- Backend modules: `tickets` (read API `GET /api/tickets/mine` and `/{id}` with ownership 404s; confirmed submit `POST /api/tickets` with Ariadna receipt and idempotency key; IT queue `GET /api/it/tickets`, record and `POST .../contact`), `catalog` (six services), `assistant` (`AssistantPort` with only `next_turn`, deterministic fake adapter, OpenAI-compatible adapter with one retry and degradation to "Pasar con TI", stateless `POST /api/assistant/turn`), `metrics` (static sample data, measured and estimated as unrelated types, `GET /api/metrics/agent?period=7|30`). `auth` gained `get_current_user` / `require_section`.
- Migration `0003_ticket_events_receipt` (`ticket_events`, `tickets.ariadna_receipt`, `tickets.submission_key`); the seed adds events and the three receipts (it fills a missing receipt on re-seed, never rewrites a ticket).
- Frontend screens: U1 `/inicio`, U2 `/tickets`, U3 `/tickets/[id]`, U4 `/solicitud`, U6 `/solicitud/conversacion`, U7 `/solicitud/enviada/[id]`, T1 `/ti/seguimiento`, T2 `/ti/tickets/[id]` (contact only), S1 `/supervisor/agente`, plus minimal Registro/Cierre placeholders and a route error boundary with retry.
- Env vars now used: `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_TIMEOUT_SECONDS`, `ASSISTANT_ADAPTER` (see README). Without them the fake adapter answers.

Decisions to keep in mind:
- T2 is contact-only: take, reassign, note and resolve are shown disabled ("Próxima etapa del prototipo"); nothing clears "Pendiente" until Phase 7 (re-seed only).
- Filtering and sorting of U2 and T1 are client-side over the full list; the SLA state is computed server-side with an injectable clock (due soon = 4 h).
- Seeded tickets are dated January 2026, so with a real clock the open ones show "Vencido".

Pending verification (manual, throwaway Neon branch only):
- Run `alembic upgrade head` (0003) and the seed; run the DB-gated tests (`test_seed_db`, then `test_sqlalchemy_tickets`; its three write tests need `ARIADNA_DB_WRITE_TESTS=1` and a re-seed afterwards), then walk the flows as Ana, Luis and Sara.
- Try a real OpenAI-compatible endpoint (free-tier models): JSON-mode support and latency under the function time limit (`vercel.json` sets no `maxDuration`; the budget assumes at least 60 s).
- Confirm copy marked `// adapted` in `frontend/src/lib/copy.ts` and the U1 summary tiles (the mock's fourth tile is "Mi equipo", the spec uses "Cerrados").
- Confirm what "Hablar con TI" / "Pasar con TI" does in U6 (assumed: it opens the confirmation of the captured draft when it is sendable, and the person submits it without a receipt).

Known follow-up: TypeScript is pinned to `^6.0.3` until `typescript-eslint` supports TS 7.
