import { describe, expect, it } from "vitest";
import { assetLabel, sampleAsset } from "./sample-assets";

describe("sample assets (static, 'Datos de ejemplo')", () => {
  it("maps the seed asset ids to a name and an icon kind", () => {
    expect(sampleAsset("PC-0412")).toEqual({ name: "Computadora de escritorio", kind: "pc" });
    expect(sampleAsset("IMP-0107")?.kind).toBe("printer");
    expect(sampleAsset("MON-0238")?.kind).toBe("monitor");
    expect(sampleAsset("TEL-0061")?.kind).toBe("phone");
  });

  it("assetLabel returns the sample name, or falls back to the raw id when unmapped", () => {
    expect(assetLabel("MON-0238")).toBe("Monitor");
    expect(assetLabel("XYZ-9999")).toBe("XYZ-9999");
    expect(sampleAsset("XYZ-9999")).toBeUndefined();
  });
});
