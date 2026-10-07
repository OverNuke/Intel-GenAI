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

Current state: Phase 0 in progress — monorepo split done; backend has the `submit_ticket` invariant and `/api/health` (6 tests green); frontend is tooling + tokens only. Pending: Alembic/Neon schema, seed, Next app shell.
