# Requirements

Source: `mock/Ariadna — prototipo.html` ("Mapa de páginas", "Páginas por rol", "Flujo de un ticket en TI"). Status as of the mock: 2026-10-05. Screen IDs refer to the page map.

## Functional

| ID | Requirement | Screens |
|---|---|---|
| RF-01 | Public landing explains what Ariadna does and what it does not (no signatures, no system fixes), with observed-study estimates labelled as such. | P1 |
| RF-02 | Demo sign-in: organization account → account picker (Ana/Usuario, Luis/TI, Sara/Supervisor); email+password demo credentials enter as Ana; inline validation with error summary. | A1, A2 |
| RF-03 | Role authorization; a role opening a foreign section lands on "Sin acceso" naming the section and the role required. | A3 |
| RF-04 | Sign-out always ends on "Sesión cerrada" → "Volver a entrar" → sign-in. | A4 |
| RF-05 | User home: greeting, "Nuevo ticket", 4 summaries, my tickets (open/closed), services, my equipment. | U1 |
| RF-06 | My tickets: search by number/title, state filter, tabs Abiertos/Cerrados/Todos, "Limpiar filtros". | U2 |
| RF-07 | Ticket detail: state, dates, user-language stages, summary, timeline, data (impact, urgency, group, assignee, asset), "Necesitamos un dato de tu parte" notice. | U3 |
| RF-08 | Service catalog (6 services) with examples, what to have at hand, who handles it; Software shows the manager-authorization notice. | U4 |
| RF-09 | *(Deferred)* My equipment: model, serial, location, since; related tickets. | U5 |
| RF-10 | Conversation with Ariadna: three entry points (new ticket, help (?) on a ticket, a service); one question at a time; "Tu solicitud" auto-fills and is editable; shows "Esto es lo que entendí", "Lo que revisé", permissions notice; "Hablar con TI" / "Pasar con TI" always available. **Agent v2:** (a) one sentence is enough to fill most of "Tu solicitud" (user edits always win); (b) gaps are flagged in two levels: red = blocking ("Falta: …", the request cannot be reviewed or sent) and amber = recommended ("Conviene revisar: …", never blocks), always with icon and text, never color alone (RNF-01); (c) Ariadna may *propose* actions (send the request, add participants, update a ticket, close a ticket) as cards that do nothing until the person presses "Confirmar"; "Ahora no" dismisses them. | U6 |
| RF-11 | Only the person submits. Confirmation screen with ticket id (e.g. INC0001061) and "Constancia de Ariadna"; new ticket appears first in "Mis tickets". | U7 |
| RF-12 | IT queue: 4 summaries, tabs Todos/Sin asignar/Asignados a mí, priority and SLA filters, search by ID/summary, sortable by priority and SLA, "Pasado por Ariadna" marker. | T1 |
| RF-13 | IT ticket record: stages (Nuevo·Asignado·En curso·Resuelto·Cerrado), SLA, Pendiente flag, tabs Resumen/Línea de tiempo/Bitácora, Ariadna receipt. Actions: take, contact user (→ Pendiente; user sees RF-07 notice), reassign, add note, mark resolved. The timeline also shows participants added, field updates ("Cambió Urgencia: antes → después"), resolved and closed. A ticket is closed by IT **or by its requester once it is Resuelto** (Ariadna prepares the action; the person confirms). | T2 |
| RF-14 | *(Partly delivered in Agent v2)* Closing with Ariadna: Ariadna prepares the close (and can add participants) and the requester or IT confirms it; closing is only allowed once the ticket is Resuelto. *(Deferred)* the full T3 screen: completeness check, related IDs, archive and internal-register entry (private step); IT writes the resolution and fixes flagged gaps. | T3 |
| RF-15 | *(View only in prototype; no real delivery)* Notice email on ticket creation: To = assigned IT group; Cc = Subgerencia head of requester; + Gerencia head if the whole area is affected. Subject "Nuevo ticket INC…: [resumen]". Only involved people. | T4 |
| RF-16 | *(Static sample data)* Agent metrics (Supervisor only): *measured* block and *estimated* block kept separate; period 7/30 days; trend as chart and as table. | S1 |

## Non-functional

- RNF-01 Plain-language es-MX; WCAG 2.1 AA; keyboard operable; `prefers-reduced-motion` honoured (tokens define reduced duration).
- RNF-02 Demo data only; banner "Prototipo académico. Datos de ejemplo."; no real PII to the LLM.
- RNF-03 The assistant never submits, updates or closes by itself: it only proposes, and the person confirms each action (see ADR-0003).
- RNF-04 LLM output validated against schemas; failures degrade to "Pasar con TI", never block the user.
- RNF-05 Deployable on Vercel as a monorepo (Next.js frontend + FastAPI backend + Neon Postgres).
- RNF-06 LLM is a free-tier model behind an OpenAI-compatible endpoint; rate limits and invalid JSON must degrade gracefully (RNF-04).

## Open questions (from the mock's "Por definir")

1. Who else receives the notice email depending on affected-area size?
2. Internal register (Excel) is private: stays a step without detail in the prototype.
3. Sample values for the proposed measured metrics (returned for wrong data, passed to IT, missing data detected).
4. ~~Can Ariadna close alone, or does IT always confirm?~~ **Answered:** Ariadna never closes alone. The requester (with Ariadna preparing it) can close their own ticket once IT marked it Resuelto; IT can close too. Every close is a human confirmation (ADR-0003).
5. "Pase de salida" screen (operator leaving the building; Supervisor approves) — today only a log note.
6. Design system v1.5 additions: IT actions, closing with Ariadna, notice email, "Sesión cerrada" as sign-out target.
