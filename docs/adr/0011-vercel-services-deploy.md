# ADR-0011: Deploy on Vercel with services

Status: accepted (2026-10-07)

## Context
Prototype must be published on Vercel; Vercel runs FastAPI as a Python function (entrypoint `app` in `app/main.py`, Python >=3.12 via `.python-version`/`requires-python`).

## Decision
Root `vercel.json` defines `services` (`frontend` root `frontend/`, `backend` root `backend/`) and a rewrite `/api/(.*)` -> backend. All FastAPI routes are mounted under `/api`. Function duration is limited on the Hobby plan, so LLM calls use a short own timeout.

## Consequences
One deployment, same origin (no CORS). The exact service `entrypoint` value is unverified until the first deploy.
