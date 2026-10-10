// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { QueueContainer } from "./queue-container";
import { QueueSummaryCards } from "./queue-summary";

afterEach(cleanup);

type Row = components["schemas"]["QueueRowOut"];
type Queue = components["schemas"]["QueueOut"];

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

const QUEUE: Queue = {
  summary: { open: 5, unassigned: 2, assigned_to_me: 3, sla_at_risk: 2 },
  tickets: [
    make(1060, { priority: "high", sla_due_at: "2026-01-14T16:00:00Z", sla_state: "on_time" }),
    make(1059, {
      status: "new",
      sla_due_at: null,
      sla_state: null,
      assignee_name: null,
      assigned_to_me: false,
      via_ariadna: true,
      summary: "Instalar firma",
    }),
    make(1058, {
      status: "new",
      priority: "low",
      sla_due_at: "2026-01-15T14:00:00Z",
      sla_state: "on_time",
      assignee_name: null,
      assigned_to_me: false,
      summary: "Monitor parpadea",
    }),
    make(1056, { priority: "critical", awaiting_user: true, sla_due_at: "2026-01-08T15:00:00Z" }),
    make(1055, { sla_due_at: "2026-01-08T08:15:00Z", via_ariadna: true }),
  ],
};

const visibleIds = () => {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent);
};

describe("QueueSummaryCards", () => {
  it("shows the four T1 counters", () => {
    render(<QueueSummaryCards summary={QUEUE.summary} />);
    const items = within(screen.getByRole("list", { name: "Resumen" })).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "5Abiertos",
      "3Asignados a mí",
      "2SLA por vencer",
      "2Sin asignar",
    ]);
  });
});

describe("QueueContainer (T1)", () => {
  it("renders the table with status, priority and SLA in text and the Ariadna marker", () => {
    render(<QueueContainer queue={QUEUE} />);
    expect(screen.getByRole("heading", { level: 1, name: "Seguimiento de tickets" })).toBeTruthy();
    expect(visibleIds()).toEqual(["INC0001060", "INC0001059", "INC0001058", "INC0001056", "INC0001055"]);
    const row = screen.getByRole("row", { name: /INC0001056/ });
    expect(within(row).getByText("Crítica")).toBeTruthy();
    expect(within(row).getByText("Pendiente")).toBeTruthy();
    expect(within(row).getByText("Vencido")).toBeTruthy();
    expect(within(row).getByRole("link", { name: "INC0001056" }).getAttribute("href")).toBe("/ti/tickets/INC0001056");
    // S-IT-7: marker on via_ariadna rows only.
    expect(screen.getAllByText("Pasado por Ariadna")).toHaveLength(2);
    expect(within(screen.getByRole("row", { name: /INC0001058/ })).queryByText("Pasado por Ariadna")).toBeNull();
  });

  it("S-IT-3/4: tabs filter unassigned and mine", () => {
    render(<QueueContainer queue={QUEUE} />);
    fireEvent.click(screen.getByRole("tab", { name: "Sin asignar" }));
    expect(visibleIds()).toEqual(["INC0001059", "INC0001058"]);
    fireEvent.click(screen.getByRole("tab", { name: "Asignados a mí" }));
    expect(visibleIds()).toEqual(["INC0001060", "INC0001056", "INC0001055"]);
  });

  it("filters by priority chip and SLA chip, and searches by id or summary", () => {
    render(<QueueContainer queue={QUEUE} />);
    fireEvent.click(screen.getByRole("button", { name: "Crítica" }));
    expect(visibleIds()).toEqual(["INC0001056"]);
    fireEvent.click(screen.getByRole("button", { name: "Crítica" }));
    fireEvent.click(screen.getByRole("button", { name: "Vencido" }));
    expect(visibleIds()).toEqual(["INC0001056", "INC0001055"]);
    fireEvent.click(screen.getByRole("button", { name: "Vencido" }));
    fireEvent.change(screen.getByLabelText("Buscar por ID o resumen"), { target: { value: "monitor" } });
    expect(visibleIds()).toEqual(["INC0001058"]);
  });

  it("S-IT-5: sorting by priority sets aria-sort and the keyboard toggles direction", () => {
    render(<QueueContainer queue={QUEUE} />);
    const header = screen.getByRole("columnheader", { name: /Prioridad/ });
    expect(header.getAttribute("aria-sort")).toBe("none");
    const button = within(header).getByRole("button");
    fireEvent.click(button);
    expect(header.getAttribute("aria-sort")).toBe("descending");
    expect(visibleIds()[0]).toBe("INC0001056");
    fireEvent.click(button);
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    expect(visibleIds()[0]).toBe("INC0001058");
  });

  it("S-IT-6: sorting by SLA ascending lists the soonest first and the undated last", () => {
    render(<QueueContainer queue={QUEUE} />);
    const header = screen.getByRole("columnheader", { name: /SLA/ });
    fireEvent.click(within(header).getByRole("button"));
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    expect(visibleIds()).toEqual(["INC0001055", "INC0001056", "INC0001060", "INC0001058", "INC0001059"]);
  });

  it("shows the empty state with a reset that restores the default view", () => {
    render(<QueueContainer queue={QUEUE} />);
    fireEvent.change(screen.getByLabelText("Buscar por ID o resumen"), { target: { value: "zzz" } });
    expect(screen.getByText("Ningún ticket coincide con los filtros.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(visibleIds()).toHaveLength(5);
  });
});
