// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NotFoundScreen } from "./not-found-screen";

afterEach(cleanup);

describe("NotFoundScreen (public 404)", () => {
  it("shows a single h1 with the plain (non-uppercased) DOM text", () => {
    render(<NotFoundScreen />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Página no encontrada");
  });

  it("explains what happened in plain language", () => {
    render(<NotFoundScreen />);
    expect(
      screen.getByText("Esta dirección no existe o cambió de lugar. Vuelve al inicio y retoma desde ahí."),
    ).toBeTruthy();
  });

  it("offers the exit link to / with a decorative arrow", () => {
    render(<NotFoundScreen />);
    const link = screen.getByRole("link", { name: "Volver al inicio" });
    expect(link.getAttribute("href")).toBe("/");
    expect(link.querySelector('[aria-hidden="true"]')?.textContent).toBe("→");
  });

  it("links the wordmark to / and 'Entrar' to /entrar", () => {
    render(<NotFoundScreen />);
    expect(screen.getByRole("link", { name: "Ariadna" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/entrar");
  });

  it("shows the prototype banner", () => {
    render(<NotFoundScreen />);
    expect(screen.getByText("Prototipo académico. Datos de ejemplo.")).toBeTruthy();
  });

  it("is not the signed-in shell", () => {
    render(<NotFoundScreen />);
    expect(screen.queryByRole("navigation", { name: "Secciones" })).toBeNull();
  });
});
