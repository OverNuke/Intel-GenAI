import type { StepState } from "@/lib/ticket-labels";
import { Icon, type IconName } from "../atoms/icon";

export type StepperStep = {
  label: string;
  state: StepState;
  /** The state as a word: it is never conveyed by colour or icon alone. */
  word: string;
  num?: number;
  note?: string;
  /** Text of the "pending" flag attached to this step (not a stage by itself). */
  pending?: string;
};

const NODE_ICON: Record<StepState, IconName> = {
  done: "circle-check",
  current: "circle-dot",
  upcoming: "circle",
};

/** One stepper markup for the ticket stages, the timeline and the draft step band. */
export function Stepper({
  steps,
  variant,
  label,
}: {
  steps: StepperStep[];
  variant: "full" | "vertical";
  label: string;
}) {
  return (
    <ol className={`stepper stepper--${variant}`} aria-label={label}>
      {steps.map((step) => (
        <li
          key={step.label}
          className={`step is-${step.state}`}
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <span className="step-node">
            <Icon name={NODE_ICON[step.state]} />
          </span>
          {step.pending ? (
            <span className="step-flag">
              <Icon name="circle-alert" size="sm" />
            </span>
          ) : null}
          <span className="step-text">
            <span>
              {step.num !== undefined ? <span className="step-num">{step.num}</span> : null}{" "}
              <span className="step-label">{step.label}</span>
            </span>
            <span className="step-state">{step.word}</span>
            {step.note ? <span className="step-note tone-muted">{step.note}</span> : null}
            {step.pending ? (
              <span className="step-note tone-warning">
                <Icon name="circle-alert" size="sm" />
                {step.pending}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
