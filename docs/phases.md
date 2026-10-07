# Development phases

Each phase ends with passing tests and a conventional-commit history. Domain and use cases are test-first (ADR-0009).

| Phase | Deliverable | Screens | Requirements |
|---|---|---|---|
| 0 Foundations | tooling (TS strict, ESLint, Prettier, Vitest, Playwright), CI, `tokens.css`, ADRs, DB schema + seed (8 sample incidents + INC0001061) | — | RNF-05 |
| 1 Design system + public/access | atoms/molecules, 3 themes, demo auth, role guards | P1, A1–A4 | RF-01..04 |
| 2 User area (real data) | tickets, catalog, assets | U1–U5 | RF-05..09 |
| 3 Ariadna | `AssistantPort`, Claude + fake adapters, conversation, "Tu solicitud", receipt, confirmed submit | U6, U7 | RF-10, RF-11, RNF-03/04 |
| 4 IT desk | queue/SLA, record, contact→Pendiente, reassign, log, closing with Ariadna, notice email | T1–T4 | RF-12..15 |
| 5 Supervisor | measured vs estimated metrics, 7/30 days, table view | S1 | RF-16 |
| 6 Publish | assistant evals, a11y audit, Vercel + Turso deploy, README | — | RNF-01, RNF-05 |

Current state: Phase 0 started (tooling, tokens, first domain test: human-confirms invariant).
