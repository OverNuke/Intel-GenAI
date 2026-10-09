// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SesionCerradaPage from "./page";

afterEach(cleanup);

describe("A4 /sesion-cerrada", () => {
  it("S-A4-1: shows the exact copy and the banner", () => {
    render(<SesionCerradaPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Cerraste sesión" })).toBeTruthy();
    expect(
      screen.getByText("Para volver, inicia sesión de nuevo. Si usas una computadora compartida, cierra también el navegador."),
    ).toBeTruthy();
    expect(screen.getByText("Prototipo académico. Datos de ejemplo.")).toBeTruthy();
  });

  it("S-A4-2: 'Volver a entrar' leads to A1", () => {
    render(<SesionCerradaPage />);
    expect(screen.getByRole("link", { name: "Volver a entrar" }).getAttribute("href")).toBe("/entrar");
  });

  it("is public: no session guard and no app shell", () => {
    render(<SesionCerradaPage />);
    expect(screen.queryByRole("navigation", { name: "Secciones" })).toBeNull();
  });
});
