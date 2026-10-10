import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { formatMeasured } from "@/lib/format-metric";

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
          <li key={metric.key} className="summary-card">
            <span className="summary-value">{formatMeasured(metric.value, metric.unit)}</span>
            <span>{metric.label}</span>
            <span className="t-meta">{metric.description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
