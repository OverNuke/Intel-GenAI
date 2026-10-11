import { describe, expect, it } from "vitest";
import { lifeStages } from "./life-stages";

const base = {
  status: "in_progress" as const,
  awaiting_user: false,
  assignee_name: "Luis Herrera" as string | null,
  updated_at: "2026-01-08T20:00:00Z",
  events: [
    { kind: "created", created_at: "2026-01-08T17:00:00Z" },
    { kind: "assigned", created_at: "2026-01-08T17:30:00Z" },
    { kind: "assigned", created_at: "2026-01-09T10:00:00Z" },
  ],
};

describe("lifeStages (REQ-UT-D5)", () => {
  it("returns the five user-language stages with state from the status", () => {
    const stages = lifeStages(base);
    expect(stages.map((s) => s.label)).toEqual([
      "Recibido",
      "Ya lo tiene un especialista",
      "En revisión por TI",
      "Resuelto",
      "Cerrado",
    ]);
    expect(stages.map((s) => s.state)).toEqual(["done", "done", "current", "upcoming", "upcoming"]);
  });

  it("dates stage 1 from the created event and stage 2 from the FIRST assigned event", () => {
    const stages = lifeStages(base);
    expect(stages[0]!.word).toBe("8 ene 2026, 11:00");
    expect(stages[1]!.word).toBe("8 ene 2026, 11:30");
  });

  it("adds 'Lo tomó {name}' to the assignment stage when the assignee is known", () => {
    expect(lifeStages(base)[1]!.note).toBe("Lo tomó Luis Herrera");
  });

  it("shows 'Sin asignar' on a reached assignment stage without assignee", () => {
    const stages = lifeStages({ ...base, assignee_name: null });
    expect(stages[1]!.note).toBe("Sin asignar");
  });

  it("does not add a note to a stage that is not reached yet", () => {
    const stages = lifeStages({ ...base, status: "new", events: [base.events[0]!] });
    expect(stages[1]!.state).toBe("upcoming");
    expect(stages[1]!.note).toBeUndefined();
    expect(stages[1]!.word).toBe("Por venir");
  });

  it("reads 'Sin fecha' for a reached stage that has no event", () => {
    const stages = lifeStages(base);
    expect(stages[2]!.word).toBe("Sin fecha");
    const noCreated = lifeStages({ ...base, events: [] });
    expect(noCreated[0]!.word).toBe("Sin fecha");
    expect(noCreated[1]!.word).toBe("Sin fecha");
  });

  it("notes the pending request on the current stage with the last update date", () => {
    const stages = lifeStages({ ...base, awaiting_user: true });
    expect(stages[2]!.note).toBe("Necesitamos un dato de tu parte desde 8 ene 2026, 14:00");
    expect(stages[1]!.note).toBe("Lo tomó Luis Herrera");
    expect(stages[3]!.note).toBeUndefined();
  });
});
