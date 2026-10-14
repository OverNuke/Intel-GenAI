import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { formatMeasured } from "@/lib/format-metric";
import { StatTile } from "../molecules/stat-tile";

type Measured = components["schemas"]["MeasuredMetricOut"];

export type MeasuredBlockProps = { metrics: Measured[] };

/** What was actually recorded. It never shares a list or a component with the estimates. */
export function MeasuredBlock({ metrics }: MeasuredBlockProps) {
  return (
    <section aria-labelledby="measured-title" className="card stack">
      <div>
        <h2 id="measured-title">{COPY.metrics.measured}</h2>
        <p className="t-meta">{COPY.metrics.measuredIntro}</p>
      </div>
      <ul aria-label={COPY.metrics.measured} className="summary-cards">
        {metrics.map((metric) => (
          <StatTile
            key={metric.key}
            label={metric.label}
            value={formatMeasured(metric.value, metric.unit)}
            basis={metric.description}
          />
        ))}
      </ul>
    </section>
  );
}
