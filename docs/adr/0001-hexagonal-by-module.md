# ADR-0001: Hexagonal architecture organised by business module

Status: accepted (2026-10-07)

## Context
Prototype will grow across 3 roles and 17 screens; UI, LLM and DB are the parts most likely to change.

## Decision
Screaming/hexagonal modules in the **backend** (`backend/app/modules/`: `tickets`, `assistant`, `auth`, `catalog`, `metrics`), each with `domain/application/infrastructure/api`. `domain` imports nothing from FastAPI, SQLAlchemy or the LLM SDK. The frontend contains no domain rules (see ADR-0010).

Update 2026-10-07: originally specified for a Next.js full-stack app; moved to Python with the monorepo split.

## Consequences
Testable core; adapters swappable. More folders and ports than a flat Next app.
