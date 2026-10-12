# ADR-0002: Ariadna behind an AssistantPort with Claude and fake adapters

Status: accepted (2026-10-07)

## Context
U6 needs real LLM guidance; CI/offline demo and tests need determinism.

## Decision
`AssistantPort` returns schema-validated structured output (service, classification, missing data, target group, permissions/authorization). Adapters: any **OpenAI-compatible** endpoint configured by `LLM_BASE_URL`/`LLM_MODEL`/`LLM_API_KEY` (free-tier models: AI Gateway, Gemini, Groq, OpenRouter `:free`); deterministic fake selected by `ASSISTANT_ADAPTER`. Output is validated with Pydantic, one retry, then degradation to "Pasar con TI" (also on HTTP 429). Tests never assert on prose; quality is covered by evals (deferred).

## Consequences
Provider-agnostic and offline-capable; schema design becomes the contract. Evals needed for real-model quality.

## Addendum (2026-10-11): deterministic facts live in the domain, not in prompts or adapters
Ariadna re-asked "¿a cuántas personas afecta?" after the person had written "a mí y a otros tres compañeros": impact was inferred only by a literal phrase table inside the fake adapter, and a free-tier model leaving `impact: null` re-raised the blocking flag. Impact is now read by `assistant/domain/impact.py` (`infer_impact`, `with_inferred_impact`) and applied in `converse` before the port is called (so no adapter asks again) and after (a model that drops it cannot lose it). It only fills an empty value; the person's edit in the draft wins. Headcounts of `HIGH_HEADCOUNT` (10) or more are read as the whole area, an assumption to tune.

**Model strategy for the prototype**: keep a hosted free-tier endpoint behind the OpenAI-compatible adapter. A local model inside the free tiers is not viable: Neon is Postgres without inference compute, and Vercel Python functions are ephemeral CPU instances that would load the model on every cold start. For an offline demo, run Ollama on the developer machine and point `LLM_BASE_URL` at it; no code change.
