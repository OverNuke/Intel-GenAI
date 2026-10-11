// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { checkAccess, redirect } = vi.hoisted(() => ({
  checkAccess: vi.fn(),
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/guard", () => ({ checkAccess }));
vi.mock("@/lib/server-context", () => ({ readServerContext: async () => ({ origin: "http://o", cookie: "c=1" }) }));
vi.mock("next/navigation", () => ({ redirect }));

import SinAccesoPage from "./page";

const allowed = (role: "user" | "it" | "supervisor") => ({
  kind: "allowed",
  user: { id: "1", name: "X", email: "x@ejemplo.mx", area: "A", role },
  section: { key: "home", label: "Inicio" },
});
const params = (q: Record<string, string | string[]>) => Promise.resolve(q);

beforeEach(() => {
  checkAccess.mockReset();
  redirect.mockClear();
});
afterEach(cleanup);

async function open(q: Record<string, string | string[]>, role: "user" | "it" | "supervisor" = "user") {
  checkAccess.mockResolvedValue(allowed(role));
  render(await SinAccesoPage({ searchParams: params(q) }));
}

describe("A3 /sin-acceso", () => {
  it("S-A3-1: names the section and the required role", async () => {
    await open({ section: "agent-tracking", required: "supervisor" });
    expect(screen.getByRole("heading", { level: 1, name: "Sin acceso" })).toBeTruthy();
    expect(screen.getByText("Seguimiento del agente es solo para Supervisor.")).toBeTruthy();
  });

  it("shows a decorative lock icon, not an emoji", async () => {
    await open({ section: "agent-tracking", required: "supervisor" });
    expect(document.querySelector('.state-icon svg[data-icon="lock"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain("🔒");
  });

  it("S-A3-2: another section and role", async () => {
    await open({ section: "ticket-tracking", required: "it" }, "supervisor");
    expect(screen.getByText("Seguimiento de tickets es solo para TI.")).toBeTruthy();
  });

  it("falls back to generic copy for unknown codes and never echoes the raw query", async () => {
    await open({ section: "<img src=x onerror=alert(1)>", required: "root" });
    expect(screen.getByText("No tienes acceso a esta sección.")).toBeTruthy();
    expect(document.body.innerHTML).not.toContain("onerror");
  });

  it("uses the first value when a param is repeated", async () => {
    await open({ section: ["registry", "closure"], required: "it" });
    expect(screen.getByText("Registro es solo para TI.")).toBeTruthy();
  });

  it("S-A3-3: 'Ir a tu sección' goes to the viewer's start section by role; 'Cambiar de cuenta' goes to sign-in", async () => {
    await open({ section: "agent-tracking", required: "supervisor" }, "it");
    expect(screen.getByRole("link", { name: "Ir a tu sección" }).getAttribute("href")).toBe("/ti/seguimiento");
    expect(screen.getByRole("link", { name: "Cambiar de cuenta" }).getAttribute("href")).toBe("/entrar");
    cleanup();
    await open({ section: "ticket-tracking", required: "it" }, "user");
    expect(screen.getByRole("link", { name: "Ir a tu sección" }).getAttribute("href")).toBe("/inicio");
  });

  it("redirects to /entrar without a session (A3-3 never shows to anonymous users)", async () => {
    checkAccess.mockResolvedValue({ kind: "unauthenticated" });
    await expect(SinAccesoPage({ searchParams: params({ section: "registry" }) })).rejects.toThrow("NEXT_REDIRECT:/entrar");
  });

  it("propagates an outage instead of redirecting", async () => {
    checkAccess.mockRejectedValue(new Error("Access check failed"));
    await expect(SinAccesoPage({ searchParams: params({}) })).rejects.toThrow("Access check failed");
    expect(redirect).not.toHaveBeenCalled();
  });
});
