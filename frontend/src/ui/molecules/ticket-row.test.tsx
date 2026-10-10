// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { TicketRow } from "./ticket-row";
import { EmptyState } from "./empty-state";

afterEach(cleanup);

type Ticket = components["schemas"]["TicketOut"];

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  id: "INC0001056",
  summary: "Red lenta en toda el área de captura",
  service: "network",
  service_label: "Red e internet",
  status: "in_progress",
  awaiting_user: false,
  via_ariadna: false,
  asset: null,
  created_at: "2026-01-08T17:00:00Z",
  updated_at: "2026-01-08T20:00:00Z",
  ...over,
});

describe("TicketRow", () => {
  it("is a single link to the ticket detail showing id, summary, state text and update date", () => {
    render(
      <ul>
        <TicketRow ticket={ticket()} />
      </ul>,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/tickets/INC0001056");
    expect(within(link).getByText("INC0001056")).toBeTruthy();
    expect(within(link).getByText("Red lenta en toda el área de captura")).toBeTruthy();
    expect(within(link).getByText("En revisión por TI")).toBeTruthy();
    expect(within(link).getByText("Actualizado 8 ene 2026, 14:00")).toBeTruthy();
  });

  it("shows the pending notice as text (not only colour) when awaiting the user", () => {
    render(
      <ul>
        <TicketRow ticket={ticket({ awaiting_user: true })} />
      </ul>,
    );
    expect(screen.getByText("Necesitamos un dato de tu parte")).toBeTruthy();
    expect(screen.queryByText("En revisión por TI")).toBeNull();
  });
});

describe("EmptyState", () => {
  it("renders the message and the action slot", () => {
    render(<EmptyState message="Ningún ticket coincide con tu búsqueda." action={<button>Limpiar filtros</button>} />);
    expect(screen.getByRole("status").textContent).toContain("Ningún ticket coincide con tu búsqueda.");
    expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeTruthy();
  });
});
