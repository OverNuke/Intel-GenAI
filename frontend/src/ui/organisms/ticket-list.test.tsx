// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { SummaryCards } from "./summary-cards";
import { TicketList } from "./ticket-list";

afterEach(cleanup);

type Ticket = components["schemas"]["TicketOut"];

const make = (n: number, summary: string): Ticket => ({
  id: `INC${String(n).padStart(7, "0")}`,
  summary,
  service: "access",
  service_label: "Cuenta y acceso",
  status: "assigned",
  awaiting_user: false,
  via_ariadna: false,
  asset: null,
  created_at: "2026-01-05T15:00:00Z",
  updated_at: "2026-01-05T15:00:00Z",
});

describe("TicketList", () => {
  it("renders one linked row per ticket in the given order", () => {
    render(<TicketList tickets={[make(1060, "Teléfono sin tono"), make(1059, "Instalar firma")]} />);
    const list = screen.getByRole("list", { name: "Tickets" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByRole("link").getAttribute("href")).toBe("/tickets/INC0001060");
    expect(within(rows[1]!).getByText("Instalar firma")).toBeTruthy();
  });
});

describe("SummaryCards", () => {
  it("shows every figure next to its label", () => {
    render(
      <SummaryCards
        items={[
          { label: "Tickets abiertos", value: 6 },
          { label: "Necesitamos un dato de tu parte", value: 1 },
        ]}
      />,
    );
    const items = within(screen.getByRole("list", { name: "Resumen" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toBe("6Tickets abiertos");
    expect(items[1]!.textContent).toBe("1Necesitamos un dato de tu parte");
  });
});
