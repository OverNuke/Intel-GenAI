export type TicketDraft = {
  requesterId: string;
  service: string;
  summary: string;
  description: string;
};

/** Quién confirma. El asistente nunca puede ser `human`: Ariadna prepara, la persona envía. */
export type Confirmation = { by: "human" | "assistant"; requesterId: string };

export type SubmitFailure =
  | "missing-human-confirmation"
  | "confirmation-not-from-requester"
  | "incomplete-draft";

export type SubmitResult =
  | { ok: true; ticket: TicketDraft & { status: "new" } }
  | { ok: false; reason: SubmitFailure };

const isComplete = (d: TicketDraft) =>
  [d.requesterId, d.service, d.summary, d.description].every((v) => v.trim() !== "");

export function submitTicket(
  draft: TicketDraft,
  confirmation: Confirmation | undefined,
): SubmitResult {
  if (confirmation?.by !== "human") {
    return { ok: false, reason: "missing-human-confirmation" };
  }
  if (confirmation.requesterId !== draft.requesterId) {
    return { ok: false, reason: "confirmation-not-from-requester" };
  }
  if (!isComplete(draft)) {
    return { ok: false, reason: "incomplete-draft" };
  }
  return { ok: true, ticket: { ...draft, status: "new" } };
}
