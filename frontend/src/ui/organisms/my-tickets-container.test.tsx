// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { MyTicketsContainer } from "./my-tickets-container";

afterEach(cleanup);

type Ticket = components["schemas"]["TicketOut"];

const make = (n: number, summary: string, status: Ticket["status"]): Ticket => ({
  id: `INC${String(n).padStart(7, "0")}`,
  summary,
  service: "access",
  service_label: "Cuenta y acceso",
  status,
  awaiting_user: false,
  via_ariadna: false,
  asset: null,
  created_at: "2026-01-05T15:00:00Z",
  updated_at: "2026-01-05T15:00:00Z",
});

const TICKETS = [
  make(1056, "Red lenta en el área de captura", "in_progress"),
  make(1055, "Correo no sincroniza", "in_progress"),
  make(1054, "Impresora sin tinta", "resolved"),
  make(1053, "No abre la sesión", "closed"),
];

const rowIds = () =>
  within(screen.getByRole("list", { name: "Tickets" }))
    .getAllByRole("listitem")
    .map((li) => li.querySelector("a")?.getAttribute("href"));

describe("MyTicketsContainer (U2)", () => {
  it("starts on Abiertos with counts in the tabs and a primary 'Nuevo ticket' action", () => {
    render(<MyTicketsContainer tickets={TICKETS} />);
    expect(screen.getByRole("heading", { level: 1, name: "Mis tickets" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Abiertos (2)" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Cerrados (2)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Todos (4)" })).toBeTruthy();
    expect(rowIds()).toEqual(["/tickets/INC0001056", "/tickets/INC0001055"]);
    expect(screen.getByRole("link", { name: "Nuevo ticket" }).getAttribute("href")).toBe(
      "/solicitud/conversacion",
    );
  });

  it("switching tabs changes the rows", () => {
    render(<MyTicketsContainer tickets={TICKETS} />);
    fireEvent.click(screen.getByRole("tab", { name: "Cerrados (2)" }));
    expect(rowIds()).toEqual(["/tickets/INC0001054", "/tickets/INC0001053"]);
  });

  it("searches by id or summary and combines with the status chip", () => {
    render(<MyTicketsContainer tickets={TICKETS} />);
    fireEvent.click(screen.getByRole("tab", { name: "Todos (4)" }));
    fireEvent.change(screen.getByLabelText("Buscar por número o título"), { target: { value: "1054" } });
    expect(rowIds()).toEqual(["/tickets/INC0001054"]);
    fireEvent.change(screen.getByLabelText("Buscar por número o título"), { target: { value: "" } });
    const chip = screen.getByRole("button", { name: "En revisión por TI" });
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(rowIds()).toEqual(["/tickets/INC0001056", "/tickets/INC0001055"]);
  });

  it("S-UT-5/11: an empty result shows the empty state and 'Limpiar filtros' resets everything", () => {
    render(<MyTicketsContainer tickets={TICKETS} />);
    fireEvent.click(screen.getByRole("tab", { name: "Todos (4)" }));
    fireEvent.change(screen.getByLabelText("Buscar por número o título"), { target: { value: "zzz" } });
    expect(screen.getByText("Ningún ticket coincide con tu búsqueda.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Tickets" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect((screen.getByLabelText("Buscar por número o título") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("tab", { name: "Abiertos (2)" }).getAttribute("aria-selected")).toBe("true");
    expect(rowIds()).toEqual(["/tickets/INC0001056", "/tickets/INC0001055"]);
  });

  it("announces the number of results politely", () => {
    render(<MyTicketsContainer tickets={TICKETS} />);
    expect(screen.getByRole("status").textContent).toBe("2 tickets");
  });

  it("uses the shared page header with the new-ticket action", () => {
    const { container } = render(<MyTicketsContainer tickets={TICKETS} />);
    const header = container.querySelector("header.page-header")!;
    expect(container.querySelector(".page-head")).toBeNull();
    expect(header.querySelectorAll("h1")).toHaveLength(1);
    expect(header.querySelector(".page-header__actions a")?.getAttribute("href")).toBe("/solicitud/conversacion");
  });
});
