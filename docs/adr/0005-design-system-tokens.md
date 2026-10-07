# ADR-0005: Own design system on the mock's tokens, no utility CSS framework

Status: accepted (2026-10-07)

## Context
Mock ships a versioned token set (v1.3/DS v1.4) with 3 themes; fidelity matters for the prototype.

## Decision
`src/ui/tokens.css` (extracted from the mock) + atoms → molecules → organisms; container/presentational split in module `ui/`. Theme via `[data-theme]`.

## Consequences
Faithful to design; more component code than Tailwind. Re-extract tokens when DS moves (v1.5).
