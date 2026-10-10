// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { AppShell } from "./app-shell";

type User = components["schemas"]["UserOut"];

afterEach(cleanup);

const ana: User = { id: "1", name: "Ana Ruiz", email: "ana.ruiz@ejemplo.mx", area: "Finanzas", role: "user" };
const luis: User = { id: "2", name: "Luis Herrera", email: "luis.herrera@ejemplo.mx", area: "Mesa de ayuda", role: "it" };
const sara: User = { id: "3", name: "Sara Molina", email: "sara.molina@ejemplo.mx", area: "Supervisión", role: "supervisor" };

const shell = (user: User, active: string) =>
  render(
    <AppShell user={user} active={active} logout={<button role="menuitem">Cerrar sesión (stub)</button>}>
      <p>contenido</p>
    </AppShell>,
  );

describe("AppShell rail", () => {
  it("Usuario: Inicio, Mis tickets and ¿Qué necesitas? are live; Mi equipo is disabled", () => {
    shell(ana, "home");
    const rail = screen.getByRole("navigation", { name: "Secciones" });
    const links = within(rail).getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Inicio", "/inicio"],
      ["Mis tickets", "/tickets"],
      ["¿Qué necesitas?", "/solicitud"],
    ]);
    expect(within(rail).getByRole("link", { name: "Inicio" }).getAttribute("aria-current")).toBe("page");
    expect(within(rail).getByText("Mi equipo").closest("[aria-disabled='true']")).not.toBeNull();
    expect(within(rail).getByText("Próxima etapa del prototipo")).toBeTruthy();
  });

  it("marks Mis tickets as the current page when that section is active", () => {
    shell(ana, "my-tickets");
    const rail = screen.getByRole("navigation", { name: "Secciones" });
    expect(within(rail).getByRole("link", { name: "Mis tickets" }).getAttribute("aria-current")).toBe("page");
    expect(within(rail).getByRole("link", { name: "Inicio" }).getAttribute("aria-current")).toBeNull();
  });

  it("TI: Seguimiento de tickets plus an enabled own-tickets group (S-AS-2)", () => {
    shell(luis, "ticket-tracking");
    const rail = screen.getByRole("navigation", { name: "Secciones" });
    const link = within(rail).getByRole("link", { name: "Seguimiento de tickets" });
    expect(link.getAttribute("href")).toBe("/ti/seguimiento");
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(within(rail).queryByRole("link", { name: "Inicio" })).toBeNull();
    const group = within(rail).getByRole("group", { name: "Tus propios tickets" });
    expect(within(group).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/tickets", "/solicitud"]);
    expect(within(group).getByText("Mi equipo").closest("[aria-disabled='true']")).not.toBeNull();
    expect(within(rail).getByText("Próxima etapa del prototipo")).toBeTruthy();
  });

  it("Supervisor: Seguimiento del agente is live and own tickets are enabled too", () => {
    shell(sara, "agent-tracking");
    const rail = screen.getByRole("navigation", { name: "Secciones" });
    expect(within(rail).getByRole("link", { name: "Seguimiento del agente" }).getAttribute("href")).toBe("/supervisor/agente");
    expect(within(rail).queryByRole("link", { name: "Seguimiento de tickets" })).toBeNull();
    const group = within(rail).getByRole("group", { name: "Tus propios tickets" });
    expect(within(group).getAllByRole("link")).toHaveLength(2);
  });
});

describe("AppShell header", () => {
  it("shows the per-role context line", () => {
    shell(ana, "home");
    expect(screen.getByText("Finanzas · Centro Administrativo Regional Sur")).toBeTruthy();
    cleanup();
    shell(luis, "ticket-tracking");
    expect(screen.getByText("Mesa de ayuda TI · Centro Administrativo Regional Sur")).toBeTruthy();
    cleanup();
    shell(sara, "agent-tracking");
    expect(screen.getByText("Supervisión de la mesa de ayuda · Centro Administrativo Regional Sur")).toBeTruthy();
  });

  it("does not show the prototype banner inside the logged-in shell", () => {
    shell(ana, "home");
    expect(screen.queryByText("Prototipo académico. Datos de ejemplo.")).toBeNull();
  });

  it("profile menu is closed until opened and then holds the logout item", () => {
    shell(luis, "ticket-tracking");
    const button = screen.getByRole("button", { name: /Luis Herrera/ });
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
    expect(within(menu).getByText("luis.herrera@ejemplo.mx · Consultor TI")).toBeTruthy();
  });

  it("Escape closes the menu", () => {
    shell(ana, "home");
    const button = screen.getByRole("button", { name: /Ana Ruiz/ });
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders the page content in main", () => {
    shell(ana, "home");
    expect(within(screen.getByRole("main")).getByText("contenido")).toBeTruthy();
  });
});
