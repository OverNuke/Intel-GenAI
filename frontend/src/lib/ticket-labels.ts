import type { components } from "./api-types";
import type { IconName } from "../ui/atoms/icon-paths";
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

export type PillTone = "info" | "neutral" | "warning" | "success";
export type Pill = { label: string; tone: PillTone; icon: IconName };

const STATUS_PILLS: Record<TicketStatus, { tone: PillTone; icon: IconName }> = {
  new: { tone: "info", icon: "inbox" },
  assigned: { tone: "neutral", icon: "user-check" },
  in_progress: { tone: "info", icon: "wrench" },
  resolved: { tone: "success", icon: "circle-check" },
  closed: { tone: "neutral", icon: "archive" },
};

/** The single status presentation (REQ-VF-3): text + icon + tone; labels differ per audience (user vs IT). */
export function statusPill(status: TicketStatus, labels: Record<TicketStatus, string> = COPY.stages): Pill {
  return { label: labels[status], ...STATUS_PILLS[status] };
}

/** The extra "awaiting the user" flag: shown next to the status pill, never instead of it. */
export function pendingPill(label: string): Pill {
  return { label, tone: "warning", icon: "circle-alert" };
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
