// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAccess, serverGet } = vi.hoisted(() => ({ requireAccess: vi.fn(), serverGet: vi.fn() }));
vi.mock("@/lib/guard", () => ({ requireAccess }));
vi.mock("@/lib/server-context", () => ({ readServerContext: async () => ({ origin: "http://o", cookie: "c=1" }) }));
vi.mock("@/lib/server-api", () => ({ serverGet }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import TicketsPage from "./page";

const ana = { id: "ana", name: "Ana Ruiz", email: "ana.ruiz@ejemplo.mx", area: "Finanzas", role: "user" };
const row = (n: number, status: string) => ({
  id: `INC${String(n).padStart(7, "0")}`,
  summary: `Ticket ${n}`,
  service: "access",
  service_label: "Cuenta y acceso",
  status,
  awaiting_user: false,
  via_ariadna: false,
  asset: null,
  created_at: "2026-01-05T15:00:00Z",
  updated_at: "2026-01-05T15:00:00Z",
});

beforeEach(() => {
  requireAccess.mockReset();
  serverGet.mockReset();
  requireAccess.mockResolvedValue({ kind: "allowed", user: ana, section: { key: "my-tickets", label: "Mis tickets" } });
});
afterEach(cleanup);

describe("/tickets (U2)", () => {
  it("guards 'my-tickets', reads /api/tickets/mine and renders the shell with the list", async () => {
    serverGet.mockResolvedValue({
      ok: true,
      data: { summary: { open: 1, awaiting: 0, resolved: 0, closed: 1 }, tickets: [row(1060, "assigned"), row(1053, "closed")] },
    });
    render(await TicketsPage());
    expect(requireAccess).toHaveBeenCalledWith("my-tickets");
    expect(serverGet).toHaveBeenCalledWith("/api/tickets/mine", undefined, { origin: "http://o", cookie: "c=1" });
    expect(screen.getByRole("heading", { level: 1, name: "Mis tickets" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ticket 1060/ }).getAttribute("href")).toBe("/tickets/INC0001060");
    expect(screen.getByRole("link", { name: "Mis tickets" }).getAttribute("aria-current")).toBe("page");
  });

  it("throws on a backend failure so app/error.tsx can show the retry state (AS-D7)", async () => {
    serverGet.mockResolvedValue({ ok: false, status: 500 });
    await expect(TicketsPage()).rejects.toThrow(/500/);
  });

  it("is rendered per request", async () => {
    const page = await import("./page");
    expect(page.dynamic).toBe("force-dynamic");
  });
});
