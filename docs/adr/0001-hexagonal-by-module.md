# ADR-0001: Hexagonal architecture organised by business module

Status: accepted (2026-10-07)

## Context
Prototype will grow across 3 roles and 17 screens; UI, LLM and DB are the parts most likely to change.

## Decision
Screaming/hexagonal modules (`tickets`, `assistant`, `auth`, `catalog`, `assets`, `metrics`, `notifications`), each with `domain/application/infrastructure/ui`. `domain` imports nothing from Next, Drizzle or the AI SDK. `src/app` only routes and composes.

## Consequences
Testable core; adapters swappable. More folders and ports than a flat Next app.
