# ADR-0007: Persistence with Drizzle + libSQL

Status: superseded by ADR-0012 (2026-10-07)

## Context
Needs relational tickets/timeline/assets; Vercel serverless can't keep a SQLite file.

## Decision
Drizzle ORM on libSQL: local file in dev, Turso in production. Seed: 8 sample incidents + INC0001061.

## Consequences
Same SQL dialect dev/prod. Adds a Turso account for deployment.
