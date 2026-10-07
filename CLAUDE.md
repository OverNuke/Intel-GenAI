# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ariadna: an AI web assistant that helps people prepare an IT request *before* submitting it (fewer misclassified tickets, missing data, missing permissions, wrong department). It does **not** replace signatures or fix system failures. Functional prototype, fictional organization ("Centro Administrativo Regional Sur"), sample data only. UI copy is **es-MX**, plain language; code, docs and commits are English.

Source of truth for UX, roles and flows is `mock/Ariadna — prototipo.html`; requirements/ADRs/phases live in `docs/`.

## Commands

Package manager is pnpm (v11). Its supply-chain policy (`minimumReleaseAge`) rejects packages published in the last ~day, so pin to older versions if an install fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Install scripts are denied in `pnpm-workspace.yaml` (`allowBuilds`).

```
pnpm dev                 # next dev
pnpm test                # vitest run (unit/integration)
pnpm test src/modules/tickets/domain/submit-ticket.test.ts   # one file
pnpm test -t "rechaza"   # by test name
pnpm test:e2e            # playwright
pnpm typecheck           # tsc --noEmit (TypeScript 7: no `baseUrl`, use `paths`)
pnpm lint
pnpm db:generate / db:migrate   # drizzle
```

Env vars (`.env.local`, never committed; `.env*` writes are blocked by permissions, so document, don't create): `ANTHROPIC_API_KEY`, `DATABASE_URL` (`file:./local.db` in dev, Turso in prod), `DATABASE_AUTH_TOKEN`, `SESSION_SECRET`, `ASSISTANT_ADAPTER` (`claude` | `fake`).

## Architecture (big picture)

Hexagonal + screaming architecture, organised **by business module**, not by technical layer:

```
src/app/            routing/composition only (Next App Router); groups per role: (public) (user) (it) (supervisor)
src/modules/<m>/    tickets, assistant, auth, catalog, assets, metrics, notifications
   domain/          pure rules, no I/O
   application/     use cases + ports (interfaces)
   infrastructure/  adapters: Drizzle/libSQL, AI SDK (Claude), mail
   ui/              container (data/state) vs presentational (pure props)
src/ui/             design system: tokens.css (extracted from the mock) → atoms → molecules → organisms
```

Rules that span many files — read `docs/adr/` before changing them:

- **The human confirms.** Ariadna prepares; only the requester submits a ticket and only IT closes one. `submitTicket` (`src/modules/tickets/domain/submit-ticket.ts`) rejects anything not confirmed by `by: "human"` who is the requester. The assistant port must never expose a submit/close capability.
- **The assistant sits behind `AssistantPort`.** Claude adapter (AI SDK, Zod-validated structured output: service, classification, missing data, target group, permissions/authorization) plus a deterministic **fake** adapter for tests/CI/offline demo. Never assert on LLM prose; validate schemas and use evals.
- **Authorization is one domain policy** (feeds the "Sin acceso" page naming the section and the role that needs it). Roles: Usuario, TI (Consultor assigns/closes, Operador executes), Supervisor (only role that sees agent metrics; does not manage others' tickets). Everyone files their own tickets.
- **Metrics keep *measured* and *estimated* as distinct types** end to end; estimates are always labelled "no son resultados medidos".
- **Strict TDD is on**: write the failing test first (domain/use cases first), then the minimum code.

## Working with the mock

`mock/Ariadna — prototipo.html` is a 2.4 MB design-tool export: a board of 9 nested bundles (React 18 + `dc-runtime` + woff2 fonts). **Never `Read` it whole** (line 376 alone is 2.4 MB). To inspect it, decode it with a small script: read `<script type="__bundler/manifest">`, base64-decode (gunzip when `compressed`), and each entry is itself a bundle with its own `manifest` and `template` (JSON-string HTML). Tokens (`TicketGuía AI tokens v1.3`, themes `grayscale|azul|verde` via `[data-theme]`) were extracted to `src/ui/tokens.css`; re-extract rather than hand-editing if the design system moves on. Screen IDs (P1, A1–A4, U1–U7, T1–T4, S1) are used across docs.

## Conventions and user rules

- Conventional commits only. **No** `Co-Authored-By` or any AI attribution in commits/PRs (user rule; overrides tool defaults).
- Don't run a build after changes (typecheck/tests are fine).
- Use `rg`/`fd`/`bat`/`eza`, not grep/find/cat/ls (`fd` is not installed on this Windows box yet).
- Keep answers short; one question at a time.
