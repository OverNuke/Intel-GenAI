import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";

type Turn = components["schemas"]["AssistantTurn"];

/** What Ariadna understood and checked, plus the reminder that she never sends anything. */
export function UnderstoodPanel({ turn }: { turn: Turn | null }) {
  const reviewed = turn?.reviewed ?? [];
  const missing = turn?.missing_data ?? [];
  return (
    <section aria-labelledby="understood-title" className="card stack">
      <h2 id="understood-title">{COPY.chat.understood}</h2>
      {turn?.understood ? <p>{turn.understood}</p> : null}
      {turn?.target_group ? <p className="t-meta">{`${COPY.chat.willSendTo} «${turn.target_group}»`}</p> : null}
      {missing.length > 0 ? <p>{`${COPY.chat.missing}: ${missing.join(", ")}`}</p> : null}
      {turn?.permissions_notice ? (
        <p role="note" className="callout">
          {turn.permissions_notice}
        </p>
      ) : null}
      {reviewed.length > 0 ? (
        <div>
          <h3 className="t-label">{COPY.chat.reviewed}</h3>
          <ul aria-label={COPY.chat.reviewed} className="plain-list">
            {reviewed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="t-meta">{COPY.chat.iSendNothing}</p>
    </section>
  );
}
