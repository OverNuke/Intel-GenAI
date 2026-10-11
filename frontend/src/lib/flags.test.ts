import { describe, expect, it } from "vitest";
import { flagView } from "./flags";

const flags = [
  { field: "impact", severity: "blocking" as const, message: "Falta indicar a cuántas personas afecta." },
  { field: "asset_number", severity: "warning" as const, message: "número de inventario (empieza con AT-)" },
];

describe("flagView", () => {
  it("is empty when the turn has no flags (the caller falls back to missing_data)", () => {
    expect(flagView({ flags: [], missing: ["impact"], edited: [] })).toEqual({ blocking: [], warnings: [] });
  });

  it("derives blocking items from the live missing fields, not from the stale server flags", () => {
    expect(flagView({ flags, missing: ["impact"], edited: [] }).blocking).toEqual([{ field: "impact", label: "Impacto" }]);
    // The person filled impact since the turn: the red item is gone at once.
    expect(flagView({ flags, missing: [], edited: ["impact"] }).blocking).toEqual([]);
    // ...and a field the server did not flag but is still empty shows up.
    expect(flagView({ flags, missing: ["impact", "urgency"], edited: [] }).blocking.map((b) => b.label)).toEqual([
      "Impacto",
      "Urgencia",
    ]);
  });

  it("keeps server warnings until the related field is edited", () => {
    expect(flagView({ flags, missing: [], edited: [] }).warnings).toEqual([flags[1]]);
    expect(flagView({ flags, missing: [], edited: ["urgency"] }).warnings).toEqual([flags[1]]);
    expect(flagView({ flags, missing: [], edited: ["description"] }).warnings).toEqual([]);
  });

  it("hides a draft-field warning once that field is edited", () => {
    const w = [{ field: "urgency", severity: "warning" as const, message: "Hay cables expuestos." }];
    expect(flagView({ flags: w, missing: [], edited: [] }).warnings).toHaveLength(1);
    expect(flagView({ flags: w, missing: [], edited: ["urgency"] }).warnings).toHaveLength(0);
  });
});
