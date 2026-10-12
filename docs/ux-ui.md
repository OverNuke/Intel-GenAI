# UX / UI

Reference: `mock/Ariadna — prototipo.html`. Do not re-derive; decode it (see `CLAUDE.md`).

## Roles and navigation

| Role | Persona | Menu |
|---|---|---|
| Usuario | Ana Ruiz, Finanzas | Inicio, Mis tickets, ¿Qué necesitas?, Mi equipo |
| TI | Luis Herrera, mesa de ayuda | Seguimiento de tickets + User pages for own tickets |
| Supervisor | Sara Molina | Seguimiento del agente + User pages for own tickets |

No role switcher in the prototype bar. Denied section → A3 "Sin acceso".

## Principles

- Plain es-MX; one question at a time; Ariadna says what she reviewed and what she did **not** do ("Yo no envío nada").
- Always an exit to a human ("Hablar con TI" / "Pasar con TI").
- Measured vs estimated never share a block; estimates carry "Estimaciones, no son resultados medidos".
- States are never colour-only (pill text + icon). Targets ≥ 44px (`--size-control`).

## Design tokens

`frontend/src/ui/tokens.css` (from "TicketGuía AI tokens v1.3"): colour roles (`--color-*`, status `--status-*-{text,tint}`), spacing 4–56, radii, sizes (rail 80, topbar 72, control 44, chat max 760, form panel 560), motion (`--duration-*`, `--easing-*`), z-layers. Themes via `[data-theme="grayscale|azul|verde"]`; accent roles only change per theme.

## Layout notes from the mock

Landing (1440 board): header → hero + product image placeholder (the header carries the Ariadna mark, an inline SVG; no raster assets) → "Lo que suele frenar una solicitud" → 5 steps → "Qué cuida" inverted card → 3 study estimates → footer legal notices (not affiliated with BMC; Remedy is a BMC trademark).
