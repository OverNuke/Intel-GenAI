import type { components } from "./api-types";
import { COPY } from "./copy";

type Event = Pick<components["schemas"]["TicketEventOut"], "kind" | "body">;

export type EventView = { title: string; lines: string[] };

/** Titles of the event kinds, shared by the requester timeline and the IT log. */
export const KIND_TITLES: Record<string, string> = {
  created: "Ticket creado",
  assigned: "Asignado a un especialista",
  contact_requested: "TI te pidió un dato",
  note: "Nota de TI",
  participants_added: COPY.events.participantsTitle,
  updated: COPY.events.updatedTitle,
  resolved: COPY.events.resolvedTitle,
  closed: COPY.events.closedTitle,
};

const FIELD_LABELS: Record<string, string> = COPY.events.fields;
const VALUE_LABELS: Record<string, Record<string, string>> = {
  impact: COPY.impact,
  urgency: COPY.urgency,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valueText(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return COPY.events.empty;
  const text = String(value);
  return VALUE_LABELS[field]?.[text] ?? text;
}

/** `{field:{before,after}}` -> lines; `null` when the body is not that shape (caller shows plain text). */
function changeLines(body: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const lines: string[] = [];
  for (const [field, change] of Object.entries(parsed)) {
    if (!isRecord(change) || !("before" in change) || !("after" in change)) return null;
    const label = FIELD_LABELS[field] ?? field;
    lines.push(`${COPY.events.changed} ${label}: ${valueText(field, change.before)} → ${valueText(field, change.after)}`);
  }
  return lines.length > 0 ? lines : null;
}

/** Presentation of one ticket event: a title and the lines under it. Display only, no rules. */
export function describeEvent(event: Event): EventView {
  const title = KIND_TITLES[event.kind] ?? "Actualización";
  const body = event.body;
  switch (event.kind) {
    case "updated": {
      if (!body) return { title, lines: [] };
      return { title, lines: changeLines(body) ?? [body] };
    }
    case "participants_added":
      return { title, lines: body ? [`${COPY.events.participantsAdded}: ${body}`] : [] };
    case "resolved":
      return { title, lines: [COPY.events.resolvedLine] };
    case "closed":
      return { title, lines: [COPY.events.closedLine] };
    default:
      return { title, lines: body ? [body] : [] };
  }
}
