import type { components } from "./api-types";
import { COPY } from "./copy";

export type TicketStatus = components["schemas"]["TicketOut"]["status"];
export type StepState = "done" | "current" | "upcoming";

/** Lifecycle order of the five stages (Pendiente is a flag, not a stage). */
export const STAGE_ORDER: readonly TicketStatus[] = ["new", "assigned", "in_progress", "resolved", "closed"];

const GLYPHS: Record<TicketStatus, string> = {
  new: "◌",
  assigned: "◔",
  in_progress: "◑",
  resolved: "✓",
  closed: "▣",
};
const PENDING_GLYPH = "!";

/** Text + glyph for a ticket's state: colour is never the only signal. */
export function stateIndicator(status: TicketStatus, awaitingUser: boolean): { label: string; glyph: string } {
  if (awaitingUser) return { label: COPY.needData, glyph: PENDING_GLYPH };
  return { label: COPY.stages[status], glyph: GLYPHS[status] };
}

export type Step = { status: TicketStatus; label: string; state: StepState; word: string };

export function stageSteps(
  status: TicketStatus,
  labels: Record<TicketStatus, string> = COPY.stages,
): Step[] {
  const current = STAGE_ORDER.indexOf(status);
  return STAGE_ORDER.map((stage, index) => {
    const state: StepState = index < current ? "done" : index === current ? "current" : "upcoming";
    return { status: stage, label: labels[stage], state, word: COPY.stepWords[state] };
  });
}

const DATE = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "5 ene 2026, 09:00" in the organisation's time zone (deterministic across machines). */
export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
