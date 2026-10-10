# ADR-0002: Ariadna behind an AssistantPort with Claude and fake adapters

Status: accepted (2026-10-07)

## Context
U6 needs real LLM guidance; CI/offline demo and tests need determinism.

## Decision
`AssistantPort` returns schema-validated structured output (service, classification, missing data, target group, permissions/authorization). Adapters: any **OpenAI-compatible** endpoint configured by `LLM_BASE_URL`/`LLM_MODEL`/`LLM_API_KEY` (free-tier models: AI Gateway, Gemini, Groq, OpenRouter `:free`); deterministic fake selected by `ASSISTANT_ADAPTER`. Output is validated with Pydantic, one retry, then degradation to "Pasar con TI" (also on HTTP 429). Tests never assert on prose; quality is covered by evals (deferred).

## Consequences
Provider-agnostic and offline-capable; schema design becomes the contract. Evals needed for real-model quality.
