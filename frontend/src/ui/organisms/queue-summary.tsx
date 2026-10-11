import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { SummaryCards } from "./summary-cards";

type Summary = components["schemas"]["QueueSummaryOut"];

/** The four T1 counters, in the mock's order. */
export function QueueSummaryCards({ summary }: { summary: Summary }) {
  return (
    <SummaryCards
      items={[
        { label: COPY.it.summary.open, value: summary.open },
        { label: COPY.it.summary.mine, value: summary.assigned_to_me },
        { label: COPY.it.summary.slaRisk, value: summary.sla_at_risk },
        { label: COPY.it.summary.unassigned, value: summary.unassigned },
      ]}
    />
  );
}
