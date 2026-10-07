# ADR-0009: Strict TDD

Status: accepted (2026-10-07)

## Context
Invariants (ADR-0003/0006) are cheap to protect at the domain level.

## Decision
Red → green → refactor, domain and use cases first (Vitest), UI with Testing Library, journeys with Playwright.

## Consequences
Slower first commit, much safer refactors.
