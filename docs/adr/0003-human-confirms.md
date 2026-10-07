# ADR-0003: The human confirms: invariant in the domain

Status: accepted (2026-10-07)

## Context
Product promise (P1, U6, U7, T3): Ariadna prepares, the person sends; IT confirms the close.

## Decision
`submitTicket` requires a confirmation `by: "human"` from the requester; closing requires IT confirmation. The assistant port exposes no submit/close capability. An architecture test asserts the port surface.

## Consequences
Impossible for a prompt or model change to send/close on its own. Open question: could Ariadna close alone later (requirements Q4).
