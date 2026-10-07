# ADR-0004: Simulated authentication with three demo accounts

Status: accepted (2026-10-07)

## Context
A1/A2: organization-account picker and demo credentials; no real identities.

## Decision
Signed-cookie session issued by the backend (itsdangerous) for Ana (Usuario), Luis (TI), Sara (Supervisor). One role-authorization policy in `auth/domain` drives guards and the A3 "Sin acceso" copy (section + required role).

## Consequences
Zero real PII; swap for real SSO later behind the same port.
