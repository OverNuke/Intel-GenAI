import { describe, expect, it } from "vitest";
import type { components } from "./api-types";
import { DEFAULT_QUEUE_FILTER, filterQueue, isDefaultQueueFilter, sortQueue } from "./queue";

type Row = components["schemas"]["QueueRowOut"];

const make = (number: number, over: Partial<Row> = {}): Row => ({
  id: `INC${String(number).padStart(7, "0")}`,
  summary: `Ticket ${number}`,
  requester_name: "Ana Ruiz",
  status: "in_progress",
  awaiting_user: false,
  priority: "medium",
  sla_due_at: "2026-01-10T10:00:00Z",
  sla_state: "overdue",
  assignee_name: "Luis Herrera",
  assigned_to_me: true,
  via_ariadna: false,
  created_at: "2026-01-05T09:00:00Z",
  updated_at: "2026-01-05T09:00:00Z",
  ...over,
});

const ROWS: Row[] = [
  make(1053, { status: "closed", priority: "medium", sla_due_at: "2026-01-06T09:00:00Z", sla_state: null }),
  make(1055, { priority: "medium", sla_due_at: "2026-01-08T08:15:00Z", via_ariadna: true, summary: "Correo no sincroniza" }),
  make(1056, { priority: "critical", sla_due_at: "2026-01-08T15:00:00Z", awaiting_user: true, summary: "Red lenta en captura" }),
  make(1058, {
    priority: "low",
    status: "new",
    sla_due_at: "2026-01-15T14:00:00Z",
    sla_state: "on_time",
    assignee_name: null,
    assigned_to_me: false,
    summary: "Monitor parpadea",
  }),
  make(1059, {
    priority: "medium",
    status: "new",
    sla_due_at: null,
    sla_state: null,
    assignee_name: null,
    assigned_to_me: false,
    via_ariadna: true,
    summary: "Instalar firma electrónica",
  }),
  make(1060, { priority: "high", status: "assigned", sla_due_at: "2026-01-14T16:00:00Z", sla_state: "on_time" }),
];

const ids = (rows: Row[]) => rows.map((r) => r.id);

describe("filterQueue", () => {
  it("Todos keeps everything; Sin asignar keeps the unassigned (S-IT-3)", () => {
    expect(filterQueue(ROWS, DEFAULT_QUEUE_FILTER)).toHaveLength(6);
    expect(ids(filterQueue(ROWS, { ...DEFAULT_QUEUE_FILTER, tab: "unassigned" }))).toEqual([
      "INC0001058",
      "INC0001059",
    ]);
  });

  it("Asignados a mí keeps the tickets whose assignee is the session user (S-IT-4)", () => {
    expect(ids(filterQueue(ROWS, { ...DEFAULT_QUEUE_FILTER, tab: "mine" }))).toEqual([
      "INC0001053",
      "INC0001055",
      "INC0001056",
      "INC0001060",
    ]);
  });

  it("filters by priority and by SLA state, combined with AND", () => {
    expect(ids(filterQueue(ROWS, { ...DEFAULT_QUEUE_FILTER, priorities: ["critical", "high"] }))).toEqual([
      "INC0001056",
      "INC0001060",
    ]);
    expect(ids(filterQueue(ROWS, { ...DEFAULT_QUEUE_FILTER, slaStates: ["overdue"] }))).toEqual([
      "INC0001055",
      "INC0001056",
    ]);
    expect(
      ids(filterQueue(ROWS, { ...DEFAULT_QUEUE_FILTER, slaStates: ["on_time"], priorities: ["low"], tab: "unassigned" })),
    ).toEqual(["INC0001058"]);
  });

  it("searches id (full or numeric) and summary, accent-insensitive", () => {
    expect(ids(filterQueue(ROWS, { ...DEFAULT_QUEUE_FILTER, search: "1056" }))).toEqual(["INC0001056"]);
    expect(ids(filterQueue(ROWS, { ...DEFAULT_QUEUE_FILTER, search: "inc0001058" }))).toEqual(["INC0001058"]);
    expect(ids(filterQueue(ROWS, { ...DEFAULT_QUEUE_FILTER, search: "ELECTRONICA" }))).toEqual(["INC0001059"]);
    expect(filterQueue(ROWS, { ...DEFAULT_QUEUE_FILTER, search: "zzz" })).toEqual([]);
  });

  it("knows when the filter is the default", () => {
    expect(isDefaultQueueFilter(DEFAULT_QUEUE_FILTER)).toBe(true);
    expect(isDefaultQueueFilter({ ...DEFAULT_QUEUE_FILTER, priorities: ["low"] })).toBe(false);
    expect(isDefaultQueueFilter({ ...DEFAULT_QUEUE_FILTER, tab: "mine" })).toBe(false);
  });
});

describe("sortQueue", () => {
  it("S-IT-5: priority descending puts critical first, then high, medium, low", () => {
    const sorted = sortQueue(ROWS, { key: "priority", dir: "desc" });
    expect(sorted[0]?.id).toBe("INC0001056");
    expect(sorted.map((r) => r.priority)).toEqual(["critical", "high", "medium", "medium", "medium", "low"]);
  });

  it("priority ascending starts from the lowest", () => {
    expect(sortQueue(ROWS, { key: "priority", dir: "asc" })[0]?.id).toBe("INC0001058");
  });

  it("S-IT-6: SLA ascending is soonest first and tickets without SLA go last", () => {
    const sorted = sortQueue(ROWS, { key: "sla", dir: "asc" });
    expect(ids(sorted)).toEqual([
      "INC0001053",
      "INC0001055",
      "INC0001056",
      "INC0001060",
      "INC0001058",
      "INC0001059",
    ]);
  });

  it("SLA descending reverses dated tickets but still keeps the undated one last", () => {
    const sorted = sortQueue(ROWS, { key: "sla", dir: "desc" });
    expect(sorted[0]?.id).toBe("INC0001058");
    expect(sorted.at(-1)?.id).toBe("INC0001059");
  });

  it("without a key it keeps the incoming order and never mutates the input", () => {
    const copy = [...ROWS];
    expect(ids(sortQueue(ROWS, { key: null, dir: "asc" }))).toEqual(ids(ROWS));
    sortQueue(ROWS, { key: "priority", dir: "desc" });
    expect(ROWS).toEqual(copy);
  });
});
