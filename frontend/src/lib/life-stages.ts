import { COPY } from "./copy";
import { STAGE_ORDER, formatDate, stageSteps, type StepState, type TicketStatus } from "./ticket-labels";

export type LifeStage = {
  status: TicketStatus;
  label: string;
  state: StepState;
  /** The date once the stage is reached, "Sin fecha" when no event backs it, "Por venir" otherwise. */
  word: string;
  note?: string;
};

type LifeInput = {
  status: TicketStatus;
  awaiting_user: boolean;
  assignee_name: string | null;
  updated_at: string;
  events: { kind: string; created_at: string }[];
};

/**
 * The five life stages of a ticket for U3 (UI mapping only): events cover created, assigned, resolved and closed;
 * in-progress (and any stage without an event) reads "Sin fecha" instead of an invented date.
 */
export function lifeStages(ticket: LifeInput): LifeStage[] {
  const created = ticket.events.find((e) => e.kind === "created");
  const assigned = ticket.events.find((e) => e.kind === "assigned");
  const dateOf: Partial<Record<TicketStatus, string>> = {};
  if (created) dateOf.new = formatDate(created.created_at);
  if (assigned) dateOf.assigned = formatDate(assigned.created_at);
  const resolved = ticket.events.find((e) => e.kind === "resolved");
  const closed = ticket.events.find((e) => e.kind === "closed");
  if (resolved) dateOf.resolved = formatDate(resolved.created_at);
  if (closed) dateOf.closed = formatDate(closed.created_at);

  return stageSteps(ticket.status, COPY.stages).map((step) => {
    const reached = step.state !== "upcoming";
    let note: string | undefined;
    if (step.state === "current" && ticket.awaiting_user) {
      note = `${COPY.detail.needDataSince} ${formatDate(ticket.updated_at)}`;
    } else if (reached && step.status === STAGE_ORDER[1]) {
      note = ticket.assignee_name ? `${COPY.detail.tookBy} ${ticket.assignee_name}` : COPY.detail.unassigned;
    }
    return {
      status: step.status,
      label: step.label,
      state: step.state,
      word: reached ? (dateOf[step.status] ?? COPY.detail.noDate) : COPY.stepWords.upcoming,
      ...(note ? { note } : {}),
    };
  });
}
