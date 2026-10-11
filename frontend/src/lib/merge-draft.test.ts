import { describe, expect, it } from "vitest";
import { draftSteps, EMPTY_DRAFT, EMPTY_TOUCHED, mergeDraft, type DraftFields } from "./merge-draft";

const current: DraftFields = {
  service: "printing",
  summary: "Mi resumen editado",
  description: "Texto del usuario",
  impact: "low",
  urgency: null,
};

describe("mergeDraft", () => {
  it("takes the suggestion for fields the user never touched", () => {
    const merged = mergeDraft(
      EMPTY_DRAFT,
      { service: "network", summary: "VPN caída", description: "No conecta", impact: "medium", urgency: "high" },
      EMPTY_TOUCHED,
    );
    expect(merged).toEqual({
      service: "network",
      summary: "VPN caída",
      description: "No conecta",
      impact: "medium",
      urgency: "high",
    });
  });

  it("S-AC-10: a touched field keeps the user's value while untouched ones update", () => {
    const merged = mergeDraft(
      current,
      { service: "network", summary: "Resumen del asistente", description: "Otro texto", impact: "high", urgency: "medium" },
      { ...EMPTY_TOUCHED, summary: true, impact: true },
    );
    expect(merged.summary).toBe("Mi resumen editado");
    expect(merged.impact).toBe("low");
    expect(merged.description).toBe("Otro texto");
    expect(merged.service).toBe("network");
    expect(merged.urgency).toBe("medium");
  });

  it("an empty or null suggestion never erases what is already in the draft", () => {
    const merged = mergeDraft(
      current,
      { service: null, summary: "", description: "", impact: null, urgency: null },
      EMPTY_TOUCHED,
    );
    expect(merged).toEqual(current);
  });

  it("does not mutate its inputs", () => {
    const before = structuredClone(current);
    mergeDraft(current, { ...current, summary: "x" }, EMPTY_TOUCHED);
    expect(current).toEqual(before);
  });
});

describe("draftSteps", () => {
  const full: DraftFields = {
    service: "printing",
    summary: "Impresora sin imprimir",
    description: "No imprime",
    impact: "low",
    urgency: "low",
  };

  it("has the four band steps and starts at \"Qué pasa\" for an empty draft", () => {
    const steps = draftSteps(EMPTY_DRAFT);
    expect(steps.map((s) => s.label)).toEqual(["Qué pasa", "Detalles", "Revisión", "Enviado"]);
    expect(steps.map((s) => s.state)).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
  });

  it("moves to Detalles once service and summary are there", () => {
    const steps = draftSteps({ ...EMPTY_DRAFT, service: "printing", summary: "Algo" });
    expect(steps.map((s) => s.state)).toEqual(["done", "current", "upcoming", "upcoming"]);
  });

  it("is at Revisión with everything filled and never marks Enviado before submission", () => {
    const steps = draftSteps(full);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "upcoming"]);
  });
});
