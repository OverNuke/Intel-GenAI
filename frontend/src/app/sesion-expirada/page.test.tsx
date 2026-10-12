// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { requireAccess, checkAccess } = vi.hoisted(() => ({ requireAccess: vi.fn(), checkAccess: vi.fn() }));
vi.mock("@/lib/guard", () => ({ requireAccess, checkAccess }));

import SesionExpiradaPage from "./page";

afterEach(() => {
  cleanup();
  requireAccess.mockClear();
  checkAccess.mockClear();
});

describe("/sesion-expirada", () => {
  it("S-SE-3: shows the heading, the line and the wordmark", () => {
    render(<SesionExpiradaPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Tu sesión expiró" })).toBeTruthy();
    expect(screen.getByText("Por seguridad cerramos tu sesión. Inicia sesión de nuevo para continuar.")).toBeTruthy();
    expect(screen.getByText("Ariadna")).toBeTruthy();
  });

  it("shows a decorative clock icon at 24px", () => {
    render(<SesionExpiradaPage />);
    const icon = document.querySelector(".state-icon");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    const svg = icon?.querySelector('svg[data-icon="clock"]');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("class")).toContain("icon-24");
  });

  it("has exactly one primary: 'Volver a entrar' to /entrar", () => {
    render(<SesionExpiradaPage />);
    const primaries = document.querySelectorAll(".btn-primary");
    expect(primaries).toHaveLength(1);
    const link = screen.getByRole("link", { name: "Volver a entrar" });
    expect(link.getAttribute("href")).toBe("/entrar");
    expect(primaries[0]).toBe(link);
  });

  it("is public: never calls the guard, no app shell", () => {
    render(<SesionExpiradaPage />);
    expect(requireAccess).not.toHaveBeenCalled();
    expect(checkAccess).not.toHaveBeenCalled();
    expect(screen.queryByRole("navigation", { name: "Secciones" })).toBeNull();
  });
});
