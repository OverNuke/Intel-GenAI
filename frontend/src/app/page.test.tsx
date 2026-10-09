// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Home from "./page";

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
});
