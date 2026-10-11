import type { components } from "./api-types";
import { COPY } from "./copy";
import type { StepState } from "./ticket-labels";

type Level = components["schemas"]["DraftOut"]["impact"];

/** The editable "Tu solicitud" values. */
export type DraftFields = {
  service: string | null;
  summary: string;
  description: string;
  impact: Level;
  urgency: Level;
};
export type DraftField = keyof DraftFields;
export type Touched = Record<DraftField, boolean>;

export const EMPTY_DRAFT: DraftFields = { service: null, summary: "", description: "", impact: null, urgency: null };
export const EMPTY_TOUCHED: Touched = { service: false, summary: false, description: false, impact: false, urgency: false };

const FIELDS = Object.keys(EMPTY_DRAFT) as DraftField[];

/**
 * Applies an assistant suggestion on top of the current draft: the person's own edits always
 * win (touched fields are kept), and an empty suggestion never erases what is already there.
 */
export function mergeDraft(current: DraftFields, suggestion: DraftFields, touched: Touched): DraftFields {
  const merged: DraftFields = { ...current };
  for (const field of FIELDS) {
    const proposed = suggestion[field];
    if (touched[field] || proposed === null || proposed === "") continue;
    (merged as Record<DraftField, unknown>)[field] = proposed;
  }
  return merged;
}

/**
 * The four steps of the "Tu solicitud" band, derived from what the draft already holds.
 * "Enviado" never completes here: sending happens in the separate confirmation step.
 */
export function draftSteps(
  draft: DraftFields,
  labels: readonly string[] = COPY.request.bandSteps,
): { label: string; state: StepState }[] {
  const done = [
    Boolean(draft.service && draft.summary.trim()),
    Boolean(draft.description.trim() && draft.impact && draft.urgency),
    false,
    false,
  ];
  let currentSeen = false;
  return labels.map((label, index) => {
    if (done[index]) return { label, state: "done" as const };
    if (currentSeen) return { label, state: "upcoming" as const };
    currentSeen = true;
    return { label, state: "current" as const };
  });
}
