// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { HomeView } from "./home-view";

afterEach(cleanup);

type Ticket = components["schemas"]["TicketOut"];
type User = components["schemas"]["UserOut"];

const ana: User = { id: "ana", name: "Ana Ruiz", email: "ana.ruiz@ejemplo.mx", area: "Finanzas", role: "user" };

const make = (n: number, summary: string, status: Ticket["status"], asset: string | null = null): Ticket => ({
  id: `INC${String(n).padStart(7, "0")}`,
  summary,
  service: "hardware",
  service_label: "Equipo de cómputo",
  status,
  awaiting_user: false,
  via_ariadna: false,
  asset,
  created_at: "2026-01-05T15:00:00Z",
  updated_at: "2026-01-05T15:00:00Z",
});

const TICKETS = [
  make(1060, "Teléfono IP sin tono", "assigned", "TEL-0061"),
  make(1058, "Monitor parpadea", "new", "MON-0238"),
  make(1054, "Impresora sin tinta", "resolved", "IMP-0107"),
  make(1053, "No abre la sesión", "closed", "MON-0238"),
];
const SUMMARY = { open: 2, awaiting: 0, resolved: 1, closed: 1 };
const SERVICES = [
  { key: "printing", label: "Impresión", description: "Impresoras y escáneres" },
  { key: "software", label: "Software", description: "Instalar o actualizar programas" },
];

const view = (over: Partial<Parameters<typeof HomeView>[0]> = {}) =>
  render(<HomeView user={ana} summary={SUMMARY} tickets={TICKETS} services={SERVICES} {...over} />);

describe("HomeView (U1)", () => {
  it("greets by first name and offers 'Nuevo ticket' towards the conversation (S-UT-9)", () => {
    view();
    expect(screen.getByRole("heading", { level: 1, name: "Hola, Ana" })).toBeTruthy();
    expect(screen.getByText("Estos son tus tickets y lo que puedes pedir hoy.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Nuevo ticket" }).getAttribute("href")).toBe("/solicitud/conversacion");
  });

  it("shows the four summary figures from the API counters", () => {
    view({ summary: { open: 4, awaiting: 1, resolved: 2, closed: 3 } });
    const items = within(screen.getByRole("list", { name: "Resumen" })).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "4Tickets abiertos",
      "1Necesitamos un dato de tu parte",
      "2Resueltos",
      "3Cerrados",
    ]);
  });

  it("splits my tickets into open and closed lists linking to the detail", () => {
    view();
    const open = screen.getByRole("list", { name: "Tickets abiertos" });
    expect(within(open).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/tickets/INC0001060",
      "/tickets/INC0001058",
    ]);
    const closed = screen.getByRole("list", { name: "Tickets cerrados" });
    expect(within(closed).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/tickets/INC0001054",
      "/tickets/INC0001053",
    ]);
    expect(screen.getByRole("link", { name: "Ver todos (4)" }).getAttribute("href")).toBe("/tickets");
  });

  it("lists services as links that start the conversation scoped to that service", () => {
    view();
    const link = screen.getByRole("link", { name: /Impresión/ });
    expect(link.getAttribute("href")).toBe("/solicitud/conversacion?servicio=printing");
    expect(screen.getByRole("link", { name: "Ver todos (2)" }).getAttribute("href")).toBe("/solicitud");
  });

  it("derives equipment from distinct ticket assets with their related tickets (UT-10)", () => {
    view();
    const equipment = screen.getByRole("list", { name: "Mi equipo" });
    const items = within(equipment).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    const monitor = items.find((i) => i.textContent?.includes("MON-0238"));
    expect(monitor?.textContent).toContain("INC0001058");
    expect(monitor?.textContent).toContain("INC0001053");
    expect(within(equipment).queryByRole("link")).toBeNull();
  });

  it("shows each asset as a card with sample name, id and the status of its latest ticket (S-UT-D6)", () => {
    view();
    const items = within(screen.getByRole("list", { name: "Mi equipo" })).getAllByRole("listitem");
    const monitor = items.find((i) => i.textContent?.includes("MON-0238"))!;
    expect(within(monitor).getByText("Monitor")).toBeTruthy();
    expect(within(monitor).getByText("MON-0238")).toBeTruthy();
    // latest related ticket is the first one (list is newest first): INC0001058 is "new" -> "Recibido" (user wording)
    expect(within(monitor).getByText("Recibido")).toBeTruthy();
    expect(monitor.querySelector('svg[data-icon="monitor"]')).not.toBeNull();
    const printer = items.find((i) => i.textContent?.includes("IMP-0107"))!;
    expect(within(printer).getByText("Resuelto")).toBeTruthy();
  });

  it("falls back to the raw id when an asset is unmapped, without crashing", () => {
    view({ tickets: [make(1058, "Algo", "new", "XYZ-9999")] });
    const card = within(screen.getByRole("list", { name: "Mi equipo" })).getByRole("listitem");
    expect(within(card).getByText("XYZ-9999", { selector: ".service-name" })).toBeTruthy();
    expect(card.textContent).toContain("INC0001058");
  });

  it("labels the section with a count badge and 'Datos de ejemplo' (REQ-VF-6)", () => {
    view();
    const heading = screen.getByRole("heading", { level: 2, name: "Mi equipo" });
    const head = heading.closest(".sec-head")!;
    expect(within(head as HTMLElement).getByText("3")).toBeTruthy();
    expect(within(head as HTMLElement).getByText("Datos de ejemplo")).toBeTruthy();
  });

  it("shows an empty equipment message when no ticket references an asset", () => {
    view({ tickets: [make(1058, "Monitor parpadea", "new")] });
    expect(screen.getByText("Todavía no hay equipos relacionados con tus tickets.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Mi equipo" })).toBeNull();
  });

  it("uses the shared page header for the greeting and no legacy page-head markup", () => {
    const { container } = view();
    const header = container.querySelector("header.page-header")!;
    expect(header.querySelectorAll("h1")).toHaveLength(1);
    expect(header.querySelector(".page-header__actions a")?.getAttribute("href")).toBe("/solicitud/conversacion");
    expect(container.querySelector(".page-head")).toBeNull();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("section headings sit in section heads with their see-all link", () => {
    view();
    for (const name of ["Mis tickets", "¿Qué necesitas?"]) {
      const head = screen.getByRole("heading", { level: 2, name }).closest(".sec-head")!;
      expect(within(head as HTMLElement).getByRole("link", { name: /^Ver todos/ })).toBeTruthy();
    }
  });
});
