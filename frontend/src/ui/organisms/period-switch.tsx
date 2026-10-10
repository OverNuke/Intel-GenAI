"use client";

import { COPY } from "@/lib/copy";

export type MetricsPeriod = 7 | 30;
const PERIODS: MetricsPeriod[] = [7, 30];

/** Radio group (arrow keys native) plus a polite status region that announces the change. */
export function PeriodSwitch({
  period,
  onChange,
}: {
  period: MetricsPeriod;
  onChange: (period: MetricsPeriod) => void;
}) {
  return (
    <div className="stack">
      <div role="radiogroup" aria-label={COPY.metrics.period} className="chip-row">
        <span className="t-meta">{COPY.metrics.period}</span>
        {PERIODS.map((value) => (
          <label key={value} className="chip">
            <input
              type="radio"
              name="periodo"
              checked={period === value}
              onChange={() => onChange(value)}
            />
            {COPY.metrics.days[value]}
          </label>
        ))}
      </div>
      <p role="status" className="t-meta">
        Mostrando los últimos {period} días
      </p>
    </div>
  );
}
