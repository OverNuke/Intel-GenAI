import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { formatEstimated } from "@/lib/format-metric";
import { StatTile } from "../molecules/stat-tile";

type Block = components["schemas"]["EstimatedBlockOut"];

export type EstimatedBlockProps = { block: Block };

/** Estimates: always under the "not measured" label, each one with its own disclaimer. */
export function EstimatedBlock({ block }: EstimatedBlockProps) {
  return (
    <section aria-labelledby="estimated-title" className="card stack">
      <div>
        <h2 id="estimated-title">{COPY.metrics.estimates}</h2>
        <p className="t-meta">{COPY.metrics.estimatesIntro}</p>
      </div>
      <p role="note" className="callout">
        {block.label}
      </p>
      <ul aria-label={COPY.metrics.estimates} className="summary-cards">
        {block.metrics.map((metric) => (
          <StatTile
            key={metric.key}
            variant="estimated"
            label={metric.label}
            value={formatEstimated(metric.value, metric.unit)}
            basis={metric.basis}
          >
            <span className="t-meta">{metric.disclaimer}</span>
          </StatTile>
        ))}
      </ul>
    </section>
  );
}
