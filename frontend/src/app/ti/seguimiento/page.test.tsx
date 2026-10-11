// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAccess, serverGet } = vi.hoisted(() => ({ requireAccess: vi.fn(), serverGet: vi.fn() }));
vi.mock("@/lib/guard", () => ({ requireAccess }));
vi.mock("@/lib/server-context", () => ({ readServerContext: async () => ({ origin: "http://o", cookie: "c=1" }) }));
vi.mock("@/lib/server-api", () => ({ serverGet }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import TiSeguimientoPage from "./page";

const luis = { id: "luis", name: "Luis Herrera", email: "luis.herrera@ejemplo.mx", area: "Mesa de ayuda", role: "it" };
const queue = {
  summary: { open: 1, unassigned: 0, assigned_to_me: 1, sla_at_risk: 1 },
  tickets: [
    {
      id: "INC0001056",
      summary: "Red lenta",
      requester_name: "Ana Ruiz",
      status: "in_progress",
      awaiting_user: true,
      priority: "critical",
      sla_due_at: "2026-01-08T15:00:00Z",
      sla_state: "overdue",
      assignee_name: "Luis Herrera",
      assigned_to_me: true,
      via_ariadna: false,
      created_at: "2026-01-08T17:00:00Z",
      updated_at: "2026-01-08T20:00:00Z",
    },
  ],
};

beforeEach(() => {
  requireAccess.mockReset();
  serverGet.mockReset();
  requireAccess.mockResolvedValue({ kind: "allowed", user: luis, section: { key: "ticket-tracking", label: "x" } });
});
afterEach(cleanup);

describe("/ti/seguimiento (T1)", () => {
  it("guards 'ticket-tracking' (A3 for the other roles comes from the guard) and renders the queue", async () => {
    serverGet.mockResolvedValue({ ok: true, data: queue });
    render(await TiSeguimientoPage());
    expect(requireAccess).toHaveBeenCalledWith("ticket-tracking");
    expect(serverGet).toHaveBeenCalledWith("/api/it/tickets", undefined, { origin: "http://o", cookie: "c=1" });
    expect(screen.getByRole("heading", { level: 1, name: "Seguimiento de tickets" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "INC0001056" })).toBeTruthy();
  });

  it("S-A3-4: a redirect thrown by the guard propagates and nothing is fetched", async () => {
    requireAccess.mockRejectedValue(new Error("NEXT_REDIRECT:/sin-acceso?section=ticket-tracking&required=it"));
    await expect(TiSeguimientoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(serverGet).not.toHaveBeenCalled();
  });

  it("a backend failure throws for the retry boundary", async () => {
    serverGet.mockResolvedValue({ ok: false, status: 500 });
    await expect(TiSeguimientoPage()).rejects.toThrow(/500/);
  });

  it("is rendered per request", async () => {
    expect((await import("./page")).dynamic).toBe("force-dynamic");
  });
});
