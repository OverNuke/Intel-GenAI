"use client";

import { useState } from "react";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { EmptyState } from "../molecules/empty-state";
import { PageHeader } from "../molecules/page-header";
import { EstimatedBlock } from "./estimated-block";
import { MeasuredBlock } from "./measured-block";
import { PeriodSwitch, type MetricsPeriod } from "./period-switch";
import { TrendChart } from "./trend-chart";
import { TrendTable } from "./trend-table";

type Report = components["schemas"]["AgentMetricsOut"];

/** S1 container: both periods arrive from the server, so switching is instant and consistent. */
export function AgentMetricsContainer({
  reports,
  initialPeriod,
}: {
  reports: Record<MetricsPeriod, Report>;
  initialPeriod: MetricsPeriod;
}) {
  const [period, setPeriod] = useState<MetricsPeriod>(initialPeriod);
  const report = reports[period];

  return (
    <div className="stack">
      <PageHeader
        title={COPY.metrics.title}
        meta={COPY.metrics.intro}
        actions={<span className="badge">{COPY.sampleData}</span>}
      />

      <PeriodSwitch period={period} onChange={setPeriod} />

      <MeasuredBlock metrics={report.measured} />
      <EstimatedBlock block={report.estimated} />

      <section aria-labelledby="trend-title" className="card stack">
        <h2 id="trend-title">{COPY.metrics.trendTitle}</h2>
        {report.trend.length === 0 ? (
          <EmptyState message={COPY.metrics.empty} />
        ) : (
          <>
            <TrendChart trend={report.trend} />
            <TrendTable trend={report.trend} />
          </>
        )}
      </section>
    </div>
  );
}
