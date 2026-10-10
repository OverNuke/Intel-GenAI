import { describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import type { EstimatedBlockProps } from "./estimated-block";
import type { MeasuredBlockProps } from "./measured-block";

type Measured = components["schemas"]["MeasuredMetricOut"];
type Estimated = components["schemas"]["EstimatedMetricOut"];

const measured: Measured = {
  kind: "measured",
  key: "passed_to_it",
  label: "Pasados a TI",
  value: 8,
  unit: "count",
  description: "d",
};
const estimated: Estimated = {
  kind: "estimated",
  key: "time_saved",
  label: "Tiempo ahorrado (estimado)",
  value: 28,
  unit: "minutes",
  basis: "b",
  disclaimer: "no son resultados medidos",
};

describe("S-AM-6: measured and estimated are not interchangeable types", () => {
  it("a measured metric cannot be given to the estimated block (compile-time) and vice versa", () => {
    // These lines are checked by `tsc`: if the types became compatible they would stop erroring
    // and `@ts-expect-error` itself would fail the typecheck.
    const asEstimated: EstimatedBlockProps = {
      // @ts-expect-error a measured metric is not an estimate
      block: { label: "Estimaciones, no son resultados medidos", metrics: [measured] },
    };
    const asMeasured: MeasuredBlockProps = {
      // @ts-expect-error an estimate is not a measured result
      metrics: [estimated],
    };
    expect(asEstimated.block.metrics).toHaveLength(1);
    expect(asMeasured.metrics).toHaveLength(1);
    // The discriminators differ at runtime too.
    expect(new Set([measured.kind, estimated.kind]).size).toBe(2);
  });
});
