import type { components } from "./api-types";

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
