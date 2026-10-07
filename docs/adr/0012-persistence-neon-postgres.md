# ADR-0012: Persistence with SQLAlchemy 2, Alembic and Neon Postgres

Status: accepted (2026-10-07)

## Context
Vercel functions have no durable shared disk; the user chose a real database over in-memory seed data.

## Decision
SQLAlchemy 2 async + psycopg 3 against Neon's **pooled** connection string with `NullPool` (each invocation is ephemeral); Alembic migrations; seed with the 8 sample incidents and INC0001061. Neon is added through the Vercel Marketplace (free tier).

## Consequences
Tickets survive cold starts and are shared across instances. Adds an account, env vars and migrations to the prototype. Supersedes ADR-0007.
