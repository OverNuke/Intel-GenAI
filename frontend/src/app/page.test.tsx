// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Home from "./page";

const BLOCKERS = [
  "Se clasifica mal o llega al área equivocada",
  "Faltan datos o hay errores en los documentos",
  "La solicitud está incompleta en el sistema",
  "No se tienen los permisos necesarios",
];

afterEach(cleanup);

describe("P1 landing", () => {
  it("S-P1-1: h1, principal nav and the banner in the footer", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "Te acompañamos a preparar tu solicitud de TI" })).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Cómo funciona",
      "Qué cuida",
      "Iniciar sesión",
    ]);
    expect(within(screen.getByRole("contentinfo")).getByText("Prototipo académico. Datos de ejemplo.")).toBeTruthy();
  });

  it("S-P1-2: 'Iniciar sesión' links lead to A1", () => {
    render(<Home />);
    const links = screen.getAllByRole("link", { name: "Iniciar sesión" });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) expect(link.getAttribute("href")).toBe("/entrar");
  });

  it("explains what Ariadna does not do", () => {
    render(<Home />);
    expect(screen.getByText("Ariadna no reemplaza las firmas ni arregla fallas del sistema.")).toBeTruthy();
  });

  it("S-P1-3: study estimates sit next to the 'no son resultados medidos' label", () => {
    render(<Home />);
    const list = screen.getByRole("list", { name: /Lo que observamos|estimaciones/i });
    const noteId = list.getAttribute("aria-describedby");
    expect(noteId).toBeTruthy();
    expect(document.getElementById(noteId!)?.textContent).toContain("no son resultados medidos");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("keeps the theme switch from phase 0", () => {
    render(<Home />);
    expect(screen.getByRole("region", { name: "Barra de prototipo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Barra de prototipo" }));
    expect(screen.getByRole("radiogroup", { name: "Tema" })).toBeTruthy();
  });

  it("anchors exist for the in-page nav", () => {
    render(<Home />);
    expect(document.getElementById("como-funciona")).not.toBeNull();
    expect(document.getElementById("que-cuida")).not.toBeNull();
  });

  it("exposes the landmarks and exactly one h1, each section labelled by its h2", () => {
    const { container } = render(<Home />);
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const section of container.querySelectorAll("main section")) {
      const id = section.getAttribute("aria-labelledby");
      expect(id).toBeTruthy();
      expect(document.getElementById(id!)?.tagName).toBe(id === "hero-title" ? "H1" : "H2");
    }
    expect(within(screen.getByRole("main")).getAllByRole("region").length).toBeGreaterThanOrEqual(6);
  });

  it("shows both product shots as labelled images with their sample-data caption", () => {
    render(<Home />);
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
    expect(screen.getByRole("img", { name: /conversación con Ariadna/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /tarjeta de confirmación/ })).toBeTruthy();
    expect(screen.getAllByText("Datos de ejemplo")).toHaveLength(2);
  });

  it("lists the four blockers, each with its own icon", () => {
    render(<Home />);
    const list = screen.getByRole("list", { name: "Lo que suele frenar una solicitud" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(BLOCKERS);
    for (const li of items) expect(li.querySelector("svg[data-icon]")).not.toBeNull();
  });

  it("keeps the five steps as an ordered list without claiming progress", () => {
    render(<Home />);
    const steps = screen.getByRole("list", { name: "Cómo funciona, en cinco pasos" });
    expect(steps.tagName).toBe("OL");
    const items = within(steps).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    ["Qué pasa", "Detalles", "Adjuntos", "Revisión", "Enviado"].forEach((name, i) => {
      expect(items[i]?.textContent).toContain(name);
    });
    expect(steps.querySelector("[aria-current]")).toBeNull();
    expect(steps.querySelector(".is-done, .is-current")).toBeNull();
  });

  it("has exactly one inverted card, holding the human-confirms promise", () => {
    const { container } = render(<Home />);
    const inverted = container.querySelectorAll(".landing-inverted");
    expect(inverted).toHaveLength(1);
    expect(inverted[0]?.textContent).toContain(
      "Antes de enviar, siempre confirmas tú. Si hay dudas, una persona de TI continúa contigo.",
    );
  });

  it("states that Ariadna is not affiliated with BMC Software", () => {
    render(<Home />);
    expect(
      within(screen.getByRole("contentinfo")).getByText(
        "Ariadna no está afiliada a BMC Software. Remedy es marca de BMC Software.",
      ),
    ).toBeTruthy();
  });

  it("closes with 'Prueba el prototipo' and a login link", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 2, name: "Prueba el prototipo" })).toBeTruthy();
  });

  it("REQ-P1-M1: exactly one primary, the hero «Iniciar sesión»; the closing CTA is secondary", () => {
    const { container } = render(<Home />);
    // The product shots are aria-hidden, inert pictures of the app; their painted button is not a page action.
    const primaries = [...container.querySelectorAll(".btn-primary")].filter((el) => el.closest(".shot") === null);
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.textContent).toBe("Iniciar sesión");
    expect(primaries[0]?.closest(".landing-hero")).not.toBeNull();
    const closing = container.querySelector(".landing-close a");
    expect(closing?.textContent).toBe("Iniciar sesión");
    expect(closing?.getAttribute("href")).toBe("/entrar");
    expect(closing?.classList.contains("btn-secondary")).toBe(true);
    expect(closing?.classList.contains("btn-primary")).toBe(false);
  });

  it("REQ-P1-M2: «Ver cómo funciona» is a text link to the anchor, not a button", () => {
    render(<Home />);
    const link = screen.getByRole("link", { name: "Ver cómo funciona" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#como-funciona");
    expect(link.classList.contains("link")).toBe(true);
    expect(link.classList.contains("btn")).toBe(false);
  });

  it("REQ-P1-M3: the observation tiles carry list-checks / clock / clock and keep the estimate label", () => {
    render(<Home />);
    const list = screen.getByRole("list", { name: /Lo que observamos|estimaciones/i });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("strong")?.textContent)).toEqual([
      "7 pasos",
      "60 a 180 min",
      "25 a 35 min",
    ]);
    expect(items.map((li) => li.querySelector("svg[data-icon]")?.getAttribute("data-icon"))).toEqual([
      "list-checks",
      "clock",
      "clock",
    ]);
    for (const li of items) expect(li.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(items[2]?.textContent).toContain("(estimado)");
    expect(screen.getByText(/no son resultados medidos/)).toBeTruthy();
  });

  it("REQ-P1-M4: no icon on the landing is larger than 24px", () => {
    const { container } = render(<Home />);
    for (const svg of container.querySelectorAll("svg[data-icon]")) {
      const size = Number(svg.getAttribute("width"));
      expect(size).toBeLessThanOrEqual(24);
    }
  });
});
