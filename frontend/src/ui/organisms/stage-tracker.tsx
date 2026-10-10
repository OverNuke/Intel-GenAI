import { COPY } from "@/lib/copy";
import { stageSteps, type TicketStatus } from "@/lib/ticket-labels";

const GLYPH = { done: "✓", current: "●", upcoming: "○" } as const;

/** The five user-language stages with the current one marked (text + glyph, not colour only). */
export function StageTracker({
  status,
  awaitingUser,
  labels = COPY.stages,
  pendingLabel = COPY.needData,
}: {
  status: TicketStatus;
  awaitingUser: boolean;
  /** User language by default; T2 passes the IT stage names. */
  labels?: Record<TicketStatus, string>;
  /** Text shown on the current stage while Pendiente; `null` to omit (T2 shows the flag itself). */
  pendingLabel?: string | null;
}) {
  return (
    <ol aria-label="Etapas del ticket" className="stage-tracker">
      {stageSteps(status, labels).map((step) => (
        <li
          key={step.status}
          className={`stage is-${step.state}`}
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <span aria-hidden="true">{GLYPH[step.state]}</span>
          <span className="stage-label">{step.label}</span>
          <span className="t-meta">{step.word}</span>
          {awaitingUser && pendingLabel && step.state === "current" ? (
            <span className="t-meta">{pendingLabel}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
