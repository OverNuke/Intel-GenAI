// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAccess } = vi.hoisted(() => ({ requireAccess: vi.fn() }));
vi.mock("@/lib/guard", () => ({ requireAccess }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import InicioPage from "./inicio/page";
import TiSeguimientoPage from "./ti/seguimiento/page";
import SupervisorAgentePage from "./supervisor/agente/page";

const user = (name: string, role: "user" | "it" | "supervisor") => ({
  id: "x",
  name,
  email: "x@ejemplo.mx",
  area: "Finanzas",
  role,
});

beforeEach(() => {
  requireAccess.mockReset();
});
afterEach(cleanup);

describe("protected placeholder pages", () => {
  it("/inicio guards 'home' and greets the user", async () => {
    requireAccess.mockResolvedValue({ kind: "allowed", user: user("Ana Ruiz", "user"), section: { key: "home", label: "Inicio" } });
    render(await InicioPage());
    expect(requireAccess).toHaveBeenCalledWith("home");
    expect(screen.getByRole("heading", { level: 1, name: "Hola, Ana" })).toBeTruthy();
    expect(screen.getByText("Estos son tus tickets y lo que puedes pedir hoy.")).toBeTruthy();
  });

  it("/ti/seguimiento guards 'ticket-tracking'", async () => {
    requireAccess.mockResolvedValue({ kind: "allowed", user: user("Luis Herrera", "it"), section: { key: "ticket-tracking", label: "x" } });
    render(await TiSeguimientoPage());
    expect(requireAccess).toHaveBeenCalledWith("ticket-tracking");
    expect(screen.getByRole("heading", { level: 1, name: "Hola, Luis" })).toBeTruthy();
    expect(screen.getByText("Seguimiento de tickets de la mesa de ayuda.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Seguimiento de tickets" }).getAttribute("aria-current")).toBe("page");
  });

  it("/supervisor/agente guards 'agent-tracking'", async () => {
    requireAccess.mockResolvedValue({ kind: "allowed", user: user("Sara Molina", "supervisor"), section: { key: "agent-tracking", label: "x" } });
    render(await SupervisorAgentePage());
    expect(requireAccess).toHaveBeenCalledWith("agent-tracking");
    expect(screen.getByRole("heading", { level: 1, name: "Hola, Sara" })).toBeTruthy();
    expect(
      screen.getByText("Seguimiento del agente: cómo se usa Ariadna y qué tanto ayuda. Solo tú ves esta sección."),
    ).toBeTruthy();
  });

  it("S-A3-4: a redirect thrown by the guard propagates and nothing renders", async () => {
    requireAccess.mockRejectedValue(new Error("NEXT_REDIRECT:/entrar"));
    await expect(TiSeguimientoPage()).rejects.toThrow("NEXT_REDIRECT:/entrar");
  });

  it("is rendered per request (force-dynamic)", async () => {
    const pages = await Promise.all([
      import("./inicio/page"),
      import("./ti/seguimiento/page"),
      import("./supervisor/agente/page"),
    ]);
    expect(pages.map((p) => p.dynamic)).toEqual(["force-dynamic", "force-dynamic", "force-dynamic"]);
  });
});
