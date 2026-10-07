# ADR-0002: Ariadna behind an AssistantPort with Claude and fake adapters

Status: accepted (2026-10-07)

## Context
U6 needs real LLM guidance; CI/offline demo and tests need determinism.

## Decision
`AssistantPort` returns Zod-validated structured output (service, classification, missing data, target group, permissions/authorization). Adapters: Claude via Vercel AI SDK; deterministic fake selected by `ASSISTANT_ADAPTER`. Tests never assert on prose; quality is covered by evals (Phase 6).

## Consequences
Provider-agnostic and offline-capable; schema design becomes the contract. Evals needed for real-model quality.
