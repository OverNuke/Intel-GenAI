# ADR-0008: Minimal data to the LLM, no real PII

Status: accepted (2026-10-07)

## Context
Prototype with sample data; internal register (Excel) is private (requirements Q2).

## Decision
Send only what the current step needs; no real personal data; the internal register stays an opaque step. Keys only in `.env.local`/Vercel env.

## Consequences
Limits personalization; keeps the prototype safe to demo.
