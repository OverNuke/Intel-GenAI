# ADR-0010: Monorepo with frontend/ and backend/

Status: accepted (2026-10-07)

## Context
The user wants FastAPI for the backend and a single repository; the Next.js scaffold was full-stack.

## Decision
`frontend/` (Next.js, UI only) and `backend/` (FastAPI, uv). No JS workspace at the root. FastAPI's OpenAPI document is the contract; the frontend generates types with `openapi-typescript`. Business rules, LLM access and persistence live only in the backend.

## Consequences
Two toolchains to maintain. Rules are tested once, in Python. The TypeScript `submitTicket` was removed.
