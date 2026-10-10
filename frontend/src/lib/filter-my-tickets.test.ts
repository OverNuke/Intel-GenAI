import { describe, expect, it } from "vitest";
import type { components } from "./api-types";
import { DEFAULT_FILTER, filterMyTickets, isDefaultFilter, tabCounts } from "./filter-my-tickets";

type Ticket = components["schemas"]["TicketOut"];

const make = (number: number, summary: string, status: Ticket["status"]): Ticket => ({
  id: `INC${String(number).padStart(7, "0")}`,
  summary,
  service: "network",
  service_label: "Red e internet",
  status,
  awaiting_user: false,
  via_ariadna: false,
  asset: null,
  created_at: "2026-01-05T09:00:00Z",
  updated_at: "2026-01-05T09:00:00Z",
});

const TICKETS: Ticket[] = [
  make(1053, "No abre la sesión en el equipo", "closed"),
  make(1054, "Impresora del pasillo sin tinta", "resolved"),
  make(1055, "Correo institucional no sincroniza", "in_progress"),
  make(1056, "Red lenta en toda el área de captura", "in_progress"),
  make(1057, "Solicitud de acceso a carpeta", "assigned"),
  make(1058, "Monitor parpadea al conectarse", "new"),
];

const ids = (list: Ticket[]) => list.map((t) => t.id);
const all = { ...DEFAULT_FILTER, tab: "all" as const };

describe("filterMyTickets", () => {
  it("defaults to the Abiertos tab (new, assigned, in_progress)", () => {
    expect(ids(filterMyTickets(TICKETS, DEFAULT_FILTER))).toEqual([
      "INC0001055",
      "INC0001056",
      "INC0001057",
      "INC0001058",
    ]);
  });

  it("Cerrados holds resolved and closed; Todos holds everything (S-UT-4)", () => {
    expect(ids(filterMyTickets(TICKETS, { ...DEFAULT_FILTER, tab: "closed" }))).toEqual([
      "INC0001053",
      "INC0001054",
    ]);
    expect(filterMyTickets(TICKETS, all)).toHaveLength(6);
  });

  it("searches by the numeric part, the full id and the summary (S-UT-3)", () => {
    expect(ids(filterMyTickets(TICKETS, { ...all, search: "1056" }))).toEqual(["INC0001056"]);
    expect(ids(filterMyTickets(TICKETS, { ...all, search: "INC0001055" }))).toEqual(["INC0001055"]);
    expect(ids(filterMyTickets(TICKETS, { ...all, search: "impresora" }))).toEqual(["INC0001054"]);
  });

  it("is case- and accent-insensitive", () => {
    expect(ids(filterMyTickets(TICKETS, { ...all, search: "SESION" }))).toEqual(["INC0001053"]);
    expect(ids(filterMyTickets(TICKETS, { ...all, search: "area" }))).toEqual(["INC0001056"]);
  });

  it("filters by status and combines with the search using AND (S-UT-5)", () => {
    const inProgress = { ...all, states: ["in_progress" as const] };
    expect(ids(filterMyTickets(TICKETS, inProgress))).toEqual(["INC0001055", "INC0001056"]);
    expect(ids(filterMyTickets(TICKETS, { ...inProgress, search: "red" }))).toEqual(["INC0001056"]);
    expect(filterMyTickets(TICKETS, { ...inProgress, search: "impresora" })).toEqual([]);
  });

  it("a status chip outside the active tab yields nothing rather than leaking rows", () => {
    expect(filterMyTickets(TICKETS, { ...DEFAULT_FILTER, states: ["closed"] })).toEqual([]);
  });
});

describe("tabCounts and isDefaultFilter", () => {
  it("counts each tab from the full list", () => {
    expect(tabCounts(TICKETS)).toEqual({ open: 4, closed: 2, all: 6 });
  });

  it("recognises the default filter and any deviation", () => {
    expect(isDefaultFilter(DEFAULT_FILTER)).toBe(true);
    expect(isDefaultFilter({ ...DEFAULT_FILTER, search: "x" })).toBe(false);
    expect(isDefaultFilter({ ...DEFAULT_FILTER, tab: "all" })).toBe(false);
    expect(isDefaultFilter({ ...DEFAULT_FILTER, states: ["new"] })).toBe(false);
  });
});
