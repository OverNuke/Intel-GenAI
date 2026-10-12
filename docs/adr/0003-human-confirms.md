# ADR-0003: The human confirms: invariant in the domain

Status: accepted (2026-10-07); amended (2026-10-11)

## Context
Product promise (P1, U6, U7, T3): Ariadna prepares, the person sends; IT confirms the close.

## Decision
`submit_ticket` (`backend/app/modules/tickets/domain/submit_ticket.py`) requires a confirmation `by: "human"` from the requester; closing requires IT confirmation. The assistant port exposes no submit/close capability. An architecture test asserts the port surface.

## Amendment (2026-10-11)
The assistant may PROPOSE writes: create a ticket, add participants, update a ticket, close a ticket. A proposal is a pure value object (`ActionProposal`); it carries no callable and the assistant port still exposes no write.

Every write executes only through a tickets use case (`submit`, `add_participants`, `update_ticket`, `close_ticket`) with a human confirmation derived from the session:

- The client sends `confirmed: true` and nothing about who is acting. The confirmation (`by="human"`, actor id and role) is built server-side from the session user. `confirmed` missing or false is a 400 and nothing is written.
- Participants are sent as typed names and resolved server-side through the `UserDirectory`; unknown or ambiguous names come back as warnings and are never guessed.
- Only the requester adds participants or edits summary, description, impact and urgency, and only while the ticket is not closed.
- Closing requires a human confirmation by IT or by the requester, and only once the ticket is Resuelto. Anything else is a 409. Closing "via Ariadna" is only the UI path: the event is authored by the person who confirmed.
- Foreign, unknown and malformed ticket ids remain indistinguishable 404s.

## Consequences
Impossible for a prompt or model change to send, edit or close on its own: the model can only emit a proposal, and a person must confirm each one against an endpoint that re-validates everything. Every write leaves an event (`participants_added`, `updated` with before/after, `closed`) in the bitácora, visible to the requester. The requirement that IT marks Resuelto first keeps the closing signature with a human on each side. Open question Q4 (could Ariadna close alone) is answered: no; the requester or IT closes, after Resuelto.
