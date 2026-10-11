import type { components } from "./api-types";
import { COPY } from "./copy";
import type { DraftField } from "./merge-draft";

type Flag = components["schemas"]["Flag"];

export const DRAFT_FIELD_LABELS: Record<DraftField, string> = {
  service: COPY.chat.service,
  summary: COPY.request.summary,
  description: COPY.detail.description,
  impact: COPY.detail.impact,
  urgency: COPY.detail.urgency,
};

export type BlockingItem = { field: string; label: string };
export type FlagView = { blocking: BlockingItem[]; warnings: Flag[] };

/** Warning fields that are not draft fields: which draft edits can resolve them. */
const RELATED_EDITS: Record<string, DraftField[]> = {
  asset_number: ["summary", "description"],
};

function isDraftField(field: string): field is DraftField {
  return field in DRAFT_FIELD_LABELS;
}

/**
 * What to show as red/amber items. Display only: the gate to send stays `missingFields`, and the
 * server re-validates on submit.
 * - red = what is still missing in the draft NOW (a stale server flag never keeps a filled field red);
 * - amber = server warnings, until the person edits the related field or a new turn arrives.
 */
export function flagView({
  flags,
  missing,
  edited,
}: {
  flags: readonly Flag[];
  missing: readonly DraftField[];
  edited: readonly DraftField[];
}): FlagView {
  if (flags.length === 0) return { blocking: [], warnings: [] };
  const blocking: BlockingItem[] = missing.map((field) => ({ field, label: DRAFT_FIELD_LABELS[field] }));
  // A blocking flag on something that is not a draft field cannot be derived client-side.
  for (const flag of flags) {
    if (flag.severity === "blocking" && !isDraftField(flag.field)) {
      blocking.push({ field: flag.field, label: flag.message });
    }
  }
  const touched = new Set<string>(edited);
  const warnings = flags.filter((flag) => {
    if (flag.severity !== "warning") return false;
    const related = isDraftField(flag.field) ? [flag.field] : (RELATED_EDITS[flag.field] ?? []);
    return !related.some((field) => touched.has(field));
  });
  return { blocking, warnings };
}
