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
      <div className="chip-row">
        <span className="t-meta" aria-hidden="true">
          {COPY.metrics.period}
        </span>
        <div role="radiogroup" aria-label={COPY.metrics.period} className="segmented">
          {PERIODS.map((value) => (
            <label key={value} className="segmented__option">
              <input
                type="radio"
                name="periodo"
                className="segmented__input"
                checked={period === value}
                onChange={() => onChange(value)}
              />
              <span>{COPY.metrics.days[value]}</span>
            </label>
          ))}
        </div>
      </div>
      <p role="status" className="t-meta">
        {COPY.metrics.showing(period)}
      </p>
    </div>
  );
}
