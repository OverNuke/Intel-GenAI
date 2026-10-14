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

  it("S-NS-1: every Usuario item shows its icon plus a visible .rail-label, in order", () => {
    shell(ana, "home");
    const rail = screen.getByRole("navigation", { name: "Secciones" });
    const items = [...rail.querySelectorAll(".rail-item")];
    expect(items.map((el) => [el.querySelector("svg")?.getAttribute("data-icon"), el.querySelector(".rail-label")?.textContent])).toEqual([
      ["house", "Inicio"],
      ["ticket", "Mis tickets"],
      ["layout-grid", "¿Qué necesitas?"],
      ["laptop", "Mi equipo"],
    ]);
    for (const el of items) {
      expect(el.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
      expect(el.getAttribute("data-tooltip")).toBe(el.querySelector(".rail-label")?.textContent);
      expect(el.hasAttribute("aria-label")).toBe(false);
    }
  });

  it("S-NS-2: TI leads with inbox and Supervisor with chart-column, then the same own-tickets group", () => {
    shell(luis, "ticket-tracking");
    let rail = screen.getByRole("navigation", { name: "Secciones" });
    expect([...rail.querySelectorAll(".rail-item svg")].map((s) => s.getAttribute("data-icon"))).toEqual([
      "inbox",
      "ticket",
      "layout-grid",
      "laptop",
    ]);
    cleanup();
    shell(sara, "agent-tracking");
    rail = screen.getByRole("navigation", { name: "Secciones" });
    expect([...rail.querySelectorAll(".rail-item svg")].map((s) => s.getAttribute("data-icon"))).toEqual([
      "chart-column",
      "ticket",
      "layout-grid",
      "laptop",
    ]);
  });

  it("S-NS-M1/M2: one Secciones landmark per role, restyled by CSS via .nav-sections, 4 items, no aria-label on items", () => {
    for (const [user, active, first] of [
      [ana, "home", "house"],
      [luis, "ticket-tracking", "inbox"],
      [sara, "agent-tracking", "chart-column"],
    ] as const) {
      shell(user, active);
      const navs = screen.getAllByRole("navigation", { name: "Secciones" });
      expect(navs).toHaveLength(1);
      expect(navs[0]!.classList.contains("nav-sections")).toBe(true);
      expect(navs[0]!.classList.contains("rail")).toBe(true);
      const items = [...navs[0]!.querySelectorAll(".rail-item")];
      expect(items).toHaveLength(4);
      expect(items[0]!.querySelector("svg")?.getAttribute("data-icon")).toBe(first);
      expect(navs[0]!.querySelectorAll("[aria-label]")).toHaveLength(0);
      cleanup();
    }
  });

  it("Mi equipo is a focusable disabled button described by the next-stage text, inert on click", () => {
    shell(ana, "home");
    const rail = screen.getByRole("navigation", { name: "Secciones" });
    const mine = within(rail).getByRole("button", { name: "Mi equipo" });
    expect(mine.getAttribute("aria-disabled")).toBe("true");
    expect(mine.hasAttribute("disabled")).toBe(false);
    const described = document.getElementById(mine.getAttribute("aria-describedby") ?? "");
    expect(described?.textContent).toBe("Próxima etapa del prototipo");
    expect(within(rail).getAllByRole("link")).toHaveLength(3);
    fireEvent.click(mine);
    expect(screen.getByRole("main").textContent).toBe("contenido");
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

describe("AppShell variant=\"chat\" (U6 islands, REQ-NS-5)", () => {
  const chat = (user: User, active: string) =>
    render(
      <AppShell user={user} active={active} variant="chat" logout={<button role="menuitem">Cerrar sesión (stub)</button>}>
        <p>contenido</p>
      </AppShell>,
    );

  it("S-NS-4: the default variant renders no .islands and no .is-chat root", () => {
    const { container } = shell(ana, "new-request");
    expect(container.querySelector(".islands")).toBeNull();
    expect(container.querySelector(".app.is-chat")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Secciones" }).classList.contains("rail")).toBe(true);
  });

  it("S-NS-3: marks the root .is-chat and renders the SAME nav as .islands instead of .rail", () => {
    const { container } = chat(ana, "new-request");
    expect(container.querySelector(".app")?.classList.contains("is-chat")).toBe(true);
    const navs = screen.getAllByRole("navigation", { name: "Secciones" });
    expect(navs).toHaveLength(1);
    expect(navs[0]!.classList.contains("islands")).toBe(true);
    expect(navs[0]!.classList.contains("nav-sections")).toBe(true);
    expect(navs[0]!.classList.contains("rail")).toBe(false);
    expect(container.querySelectorAll(".rail")).toHaveLength(0);
  });

  it("keeps the rail items: 3 links + disabled Mi equipo, icons, names from .rail-label, no aria-label", () => {
    chat(ana, "new-request");
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(within(nav).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Inicio", "/inicio"],
      ["Mis tickets", "/tickets"],
      ["¿Qué necesitas?", "/solicitud"],
    ]);
    expect(within(nav).getByRole("link", { name: "Mis tickets" })).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "¿Qué necesitas?" }).getAttribute("aria-current")).toBe("page");
    const mine = within(nav).getByRole("button", { name: "Mi equipo" });
    expect(mine.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(mine.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Próxima etapa del prototipo",
    );
    const items = [...nav.querySelectorAll(".rail-item")];
    expect(items.map((el) => el.querySelector("svg")?.getAttribute("data-icon"))).toEqual([
      "house",
      "ticket",
      "layout-grid",
      "laptop",
    ]);
    expect(nav.querySelectorAll("[aria-label]")).toHaveLength(0);
  });

  it("still exposes one Secciones landmark with 4 items for TI and Supervisor", () => {
    for (const [user, active] of [
      [luis, "new-request"],
      [sara, "new-request"],
    ] as const) {
      chat(user, active);
      const navs = screen.getAllByRole("navigation", { name: "Secciones" });
      expect(navs).toHaveLength(1);
      expect(navs[0]!.querySelectorAll(".rail-item")).toHaveLength(4);
      expect(navs[0]!.classList.contains("islands")).toBe(true);
      cleanup();
    }
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

  it("S-NS-4: the profile button shows a decorative chevron-down that flips to chevron-up when open", () => {
    shell(ana, "home");
    const button = screen.getByRole("button", { name: /Ana Ruiz/ });
    expect(button.querySelector('svg[data-icon="chevron-down"]')?.getAttribute("aria-hidden")).toBe("true");
    expect(button.querySelector('svg[data-icon="chevron-up"]')).toBeNull();
    fireEvent.click(button);
    expect(button.querySelector('svg[data-icon="chevron-up"]')).not.toBeNull();
    expect(button.querySelector('svg[data-icon="chevron-down"]')).toBeNull();
    expect(button.textContent).toContain("Ana Ruiz");
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
  it("keeps the section nav outside main (main is a size container: fixed descendants would anchor to it)", () => {
    shell(ana, "home");
    const main = screen.getByRole("main");
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(main.contains(nav)).toBe(false);
  });
});
