import { describe, expect, it } from "vitest";
import { describeEvent } from "./ticket-events";

const ev = (kind: string, body: string | null) => ({ id: "e1", kind, body, created_at: "2026-01-08T17:00:00Z" });

describe("describeEvent", () => {
  it("keeps the existing kinds", () => {
    expect(describeEvent(ev("created", null))).toEqual({ title: "Ticket creado", lines: [] });
    expect(describeEvent(ev("note", "Hola"))).toEqual({ title: "Nota de TI", lines: ["Hola"] });
  });

  it("renders an updated event as one «Cambió campo: antes → después» line per field", () => {
    const body = JSON.stringify({
      summary: { before: "Red lenta", after: "Red caída" },
      urgency: { before: "low", after: "high" },
    });
    expect(describeEvent(ev("updated", body))).toEqual({
      title: "Se actualizó el ticket",
      lines: ["Cambió Resumen: Red lenta → Red caída", "Cambió Urgencia: Puede esperar → No puedo trabajar"],
    });
  });

  it("falls back to plain text when the updated body is not the expected JSON", () => {
    expect(describeEvent(ev("updated", "no es json")).lines).toEqual(["no es json"]);
    expect(describeEvent(ev("updated", "[1,2]")).lines).toEqual(["[1,2]"]);
    expect(describeEvent(ev("updated", '{"summary":"x"}')).lines).toEqual(['{"summary":"x"}']);
    expect(describeEvent(ev("updated", null)).lines).toEqual([]);
  });

  it("labels unknown fields with the raw key and empty values with a placeholder", () => {
    const body = JSON.stringify({ asset: { before: null, after: "AT-1" } });
    expect(describeEvent(ev("updated", body)).lines).toEqual(["Cambió asset: (vacío) → AT-1"]);
  });

  it("renders participants_added, resolved and closed", () => {
    expect(describeEvent(ev("participants_added", "Luis Herrera, Marta Díaz"))).toEqual({
      title: "Se agregaron participantes",
      lines: ["Se agregó a: Luis Herrera, Marta Díaz"],
    });
    expect(describeEvent(ev("resolved", null))).toEqual({
      title: "Ticket resuelto",
      lines: ["TI marcó el ticket como resuelto."],
    });
    expect(describeEvent(ev("closed", null))).toEqual({ title: "Ticket cerrado", lines: ["El ticket se cerró."] });
  });

  it("uses a generic title for unknown kinds", () => {
    expect(describeEvent(ev("whatever", null)).title).toBe("Actualización");
  });
});
