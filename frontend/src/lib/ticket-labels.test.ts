import { describe, expect, it } from "vitest";
import { COPY } from "./copy";
import { STAGE_ORDER, firstName, formatDate, pendingPill, stageSteps, stateIndicator, statusPill } from "./ticket-labels";

describe("stateIndicator", () => {
  it("returns the plain stage label with a glyph (never colour only)", () => {
    expect(stateIndicator("in_progress", false)).toEqual({ label: "En revisión por TI", glyph: "◑" });
    expect(stateIndicator("closed", false)).toEqual({ label: "Cerrado", glyph: "▣" });
  });

  it("shows the pending notice instead of the stage when the ticket awaits the user", () => {
    expect(stateIndicator("in_progress", true)).toEqual({
      label: "Necesitamos un dato de tu parte",
      glyph: "!",
    });
  });
});

describe("stageSteps", () => {
  it("marks earlier stages done and the current one current (S-UT-15)", () => {
    const steps = stageSteps("in_progress");
    expect(steps.map((s) => [s.label, s.state])).toEqual([
      ["Recibido", "done"],
      ["Ya lo tiene un especialista", "done"],
      ["En revisión por TI", "current"],
      ["Resuelto", "upcoming"],
      ["Cerrado", "upcoming"],
    ]);
    expect(steps.map((s) => s.word)).toEqual([
      "Completado",
      "Completado",
      "Paso actual",
      "Por venir",
      "Por venir",
    ]);
  });

  it("marks the first stage as current for a new ticket", () => {
    const steps = stageSteps("new");
    expect(steps[0]?.state).toBe("current");
    expect(steps.slice(1).every((s) => s.state === "upcoming")).toBe(true);
  });
});

describe("formatDate and firstName", () => {
  it("formats in the organisation's time zone (es-MX)", () => {
    expect(formatDate("2026-01-05T15:00:00Z")).toBe("5 ene 2026, 09:00");
    expect(formatDate("2026-01-14T14:20:00Z")).toBe("14 ene 2026, 08:20");
  });

  it("takes the first word of a display name", () => {
    expect(firstName("Ana Ruiz")).toBe("Ana");
    expect(firstName("Luis")).toBe("Luis");
  });
});

describe("statusPill (REQ-VF-3: one mapping, text AND icon)", () => {
  it("maps the five statuses to tone and icon with the user wording by default", () => {
    expect(statusPill("new")).toEqual({ label: "Recibido", tone: "info", icon: "inbox" });
    expect(statusPill("assigned")).toEqual({
      label: "Ya lo tiene un especialista",
      tone: "neutral",
      icon: "user-check",
    });
    expect(statusPill("in_progress")).toEqual({ label: "En revisión por TI", tone: "info", icon: "wrench" });
    expect(statusPill("resolved")).toEqual({ label: "Resuelto", tone: "success", icon: "circle-check" });
    expect(statusPill("closed")).toEqual({ label: "Cerrado", tone: "neutral", icon: "archive" });
  });

  it("uses the IT wording when given the IT labels (S-VF-1: En curso with a wrench)", () => {
    expect(statusPill("in_progress", COPY.it.statuses)).toEqual({
      label: "En curso",
      tone: "info",
      icon: "wrench",
    });
    expect(statusPill("new", COPY.it.statuses).label).toBe("Nuevo");
  });

  it("never returns empty text or an empty icon for any status (S-VF-2)", () => {
    for (const status of STAGE_ORDER) {
      const pill = statusPill(status);
      expect(pill.label.length).toBeGreaterThan(0);
      expect(pill.icon.length).toBeGreaterThan(0);
    }
    expect(STAGE_ORDER).toHaveLength(5);
  });
});

describe("pendingPill", () => {
  it("is the additional warning flag with the given text, not a stage", () => {
    expect(pendingPill("Pendiente")).toEqual({ label: "Pendiente", tone: "warning", icon: "circle-alert" });
    expect(pendingPill(COPY.needData).label).toBe("Necesitamos un dato de tu parte");
  });
});
