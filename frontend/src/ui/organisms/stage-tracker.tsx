import { COPY } from "@/lib/copy";
import { stageSteps, type TicketStatus } from "@/lib/ticket-labels";
import { Stepper } from "../molecules/stepper";

/** The five stages as the full stepper: number, state word and, while Pendiente, a flag on the current one. */
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
  const steps = stageSteps(status, labels).map((step, index) => ({
    label: step.label,
    state: step.state,
    word: step.word,
    num: index + 1,
    ...(awaitingUser && pendingLabel && step.state === "current" ? { pending: pendingLabel } : {}),
  }));
  return <Stepper steps={steps} variant="full" label={COPY.detail.stagesLabel} />;
}
