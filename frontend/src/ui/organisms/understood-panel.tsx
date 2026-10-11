import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import type { FlagView } from "@/lib/flags";
import { Icon } from "../atoms/icon";
import { FlagList } from "../molecules/flag-list";

type Turn = components["schemas"]["AssistantTurn"];

const NO_FLAGS: FlagView = { blocking: [], warnings: [] };

/**
 * What Ariadna understood and checked, plus the reminder that she never sends anything.
 * `flags` is the already-derived red/amber view (see `flagView`); with none, the plain
 * `missing_data` line is the fallback.
 */
export function UnderstoodPanel({ turn, flags = NO_FLAGS }: { turn: Turn | null; flags?: FlagView }) {
  const reviewed = turn?.reviewed ?? [];
  const failedSteps = (turn?.steps ?? []).filter((step) => !step.ok);
  const missing = turn?.missing_data ?? [];
  const hasFlags = flags.blocking.length > 0 || flags.warnings.length > 0;
  return (
    <section aria-labelledby="understood-title" className="card stack">
      <h2 id="understood-title">{COPY.chat.understood}</h2>
      {turn?.understood ? <p>{turn.understood}</p> : null}
      {turn?.target_group ? <p className="t-meta">{`${COPY.chat.willSendTo} «${turn.target_group}»`}</p> : null}
      {hasFlags ? (
        <FlagList blocking={flags.blocking} warnings={flags.warnings} />
      ) : missing.length > 0 && (turn?.flags ?? []).length === 0 ? (
        <p>{`${COPY.chat.missing}: ${missing.join(", ")}`}</p>
      ) : null}
      {turn?.permissions_notice ? (
        <p role="note" className="callout">
          {turn.permissions_notice}
        </p>
      ) : null}
      {reviewed.length > 0 || failedSteps.length > 0 ? (
        <div>
          <h3 className="t-label row">
            <Icon name="list-checks" size="sm" />
            {COPY.chat.reviewed}
          </h3>
          <ul aria-label={COPY.chat.reviewed} className="plain-list">
            {reviewed.map((item) => (
              <li key={item}>{item}</li>
            ))}
            {failedSteps.map((step, index) => (
              <li key={`failed-${step.name}-${index}`} className="alert tone-warning">
                <Icon name="triangle-alert" />
                <p>
                  <strong>{COPY.chat.stepFailedPrefix}:</strong> {step.summary}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="t-meta">{COPY.chat.iSendNothing}</p>
    </section>
  );
}
