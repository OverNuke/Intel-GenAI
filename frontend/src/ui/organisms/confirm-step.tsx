import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { Button } from "../atoms/button";

type Level = components["schemas"]["DraftOut"]["impact"];

export type ConfirmDraft = {
  serviceLabel: string | null;
  summary: string;
  description: string;
  impact: Level;
  urgency: Level;
  targetGroup: string | null;
};

export type ConfirmStatus = "idle" | "busy" | "error";

/**
 * Explicit confirmation before submit (REQ-TS-10): shows the draft and a single button that the
 * person presses. Ariadna never presses it; this component only reports the press.
 */
export function ConfirmStep({
  draft,
  requesterName,
  status,
  onConfirm,
  onBack,
}: {
  draft: ConfirmDraft;
  requesterName: string;
  status: ConfirmStatus;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const rows: [string, string][] = [
    [COPY.detail.requester, requesterName],
    [COPY.request.summary, draft.summary || COPY.request.toComplete],
    [COPY.detail.description, draft.description || COPY.request.toComplete],
    [COPY.detail.impact, draft.impact ? COPY.impact[draft.impact] : COPY.request.toComplete],
    [COPY.detail.urgency, draft.urgency ? COPY.urgency[draft.urgency] : COPY.request.toComplete],
    [COPY.request.suggestedGroup, draft.targetGroup ?? COPY.request.toConfirm],
  ];

  return (
    <section aria-labelledby="confirm-title" className="stack">
      <h2 id="confirm-title" tabIndex={-1}>
        {COPY.request.yourRequest}
      </h2>
      {draft.serviceLabel ? <p className="t-meta">{draft.serviceLabel}</p> : null}
      <ul aria-label="Datos de tu solicitud" className="plain-list data-rows">
        {rows.map(([label, value]) => (
          <li key={label}>
            <span className="t-meta">{label}</span> <span>{value}</span>
          </li>
        ))}
      </ul>
      <p>{COPY.request.sendNotice}</p>
      {status === "error" ? (
        <p role="alert" className="callout">
          {COPY.request.sendError}
        </p>
      ) : null}
      <div className="actions">
        <Button variant="secondary" onClick={onBack} disabled={status === "busy"}>
          {COPY.request.back}
        </Button>
        <Button busy={status === "busy"} busyLabel={COPY.request.sending} onClick={onConfirm}>
          {COPY.request.send}
        </Button>
      </div>
    </section>
  );
}
