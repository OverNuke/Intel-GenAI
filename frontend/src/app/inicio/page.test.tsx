// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAccess, serverGet } = vi.hoisted(() => ({ requireAccess: vi.fn(), serverGet: vi.fn() }));
vi.mock("@/lib/guard", () => ({ requireAccess }));
vi.mock("@/lib/server-context", () => ({ readServerContext: async () => ({ origin: "http://o", cookie: "c=1" }) }));
vi.mock("@/lib/server-api", () => ({ serverGet }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import InicioPage from "./page";

const ana = { id: "ana", name: "Ana Ruiz", email: "ana.ruiz@ejemplo.mx", area: "Finanzas", role: "user" };

beforeEach(() => {
  requireAccess.mockReset();
  serverGet.mockReset();
  requireAccess.mockResolvedValue({ kind: "allowed", user: ana, section: { key: "home", label: "Inicio" } });
});
afterEach(cleanup);

describe("/inicio (U1)", () => {
  it("S-AS-1: renders U1 inside the shell, not the placeholder", async () => {
    serverGet.mockImplementation(async (path: string) => {
      if (path === "/api/tickets/mine") {
        return {
          ok: true,
          data: {
            summary: { open: 1, awaiting: 1, resolved: 0, closed: 0 },
            tickets: [
              {
                id: "INC0001056",
                summary: "Red lenta",
                service: "network",
                service_label: "Red e internet",
                status: "in_progress",
                awaiting_user: true,
                via_ariadna: false,
                asset: null,
                created_at: "2026-01-08T17:00:00Z",
                updated_at: "2026-01-08T20:00:00Z",
              },
            ],
          },
        };
      }
      if (path === "/api/catalog/services") {
        return {
          ok: true,
          data: [
            {
              key: "printing",
              label: "Impresión",
              description: "Impresoras y escáneres",
              examples: [],
              have_at_hand: [],
              handled_by: "Soporte de impresión",
              requires_manager_authorization: false,
            },
          ],
        };
      }
      return { ok: false, status: 404 };
    });
    render(await InicioPage());
    expect(requireAccess).toHaveBeenCalledWith("home");
    expect(screen.getByRole("heading", { level: 1, name: "Hola, Ana" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Nuevo ticket" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Red lenta/ }).getAttribute("href")).toBe("/tickets/INC0001056");
    expect(screen.getByRole("link", { name: /Impresión/ }).getAttribute("href")).toBe(
      "/solicitud/conversacion?servicio=printing",
    );
  });

  it("throws on a backend failure so the error boundary shows the retry state", async () => {
    serverGet.mockResolvedValue({ ok: false, status: 502 });
    await expect(InicioPage()).rejects.toThrow(/502/);
  });
});
