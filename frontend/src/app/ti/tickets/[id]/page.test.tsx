// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAccess, serverGet, notFound } = vi.hoisted(() => ({
  requireAccess: vi.fn(),
  serverGet: vi.fn(),
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/guard", () => ({ requireAccess }));
vi.mock("@/lib/server-context", () => ({ readServerContext: async () => ({ origin: "http://o", cookie: "c=1" }) }));
vi.mock("@/lib/server-api", () => ({ serverGet }));
vi.mock("next/navigation", () => ({ notFound, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import TiTicketPage from "./page";

const luis = { id: "luis", name: "Luis Herrera", email: "luis.herrera@ejemplo.mx", area: "Mesa de ayuda", role: "it" };
const record = {
  id: "INC0001056",
  summary: "Red lenta",
  description: "Lenta.",
  service: "network",
  service_label: "Red e internet",
  status: "in_progress",
  awaiting_user: true,
  priority: "critical",
  impact: "high",
  urgency: "high",
  assigned_group: "Soporte TI",
  assignee_name: "Luis Herrera",
  requester_name: "Ana Ruiz",
  asset: null,
  via_ariadna: false,
  sla_due_at: null,
  sla_state: null,
  created_at: "2026-01-08T17:00:00Z",
  updated_at: "2026-01-08T20:00:00Z",
  events: [],
  participants: [],
  receipt: null,
};

beforeEach(() => {
  requireAccess.mockReset();
  serverGet.mockReset();
  notFound.mockClear();
  requireAccess.mockResolvedValue({ kind: "allowed", user: luis, section: { key: "ticket-tracking", label: "x" } });
});
afterEach(cleanup);

describe("/ti/tickets/[id] (T2)", () => {
  it("awaits params, guards 'ticket-tracking' and renders the record", async () => {
    serverGet.mockResolvedValue({ ok: true, data: record });
    render(await TiTicketPage({ params: Promise.resolve({ id: "INC0001056" }) }));
    expect(requireAccess).toHaveBeenCalledWith("ticket-tracking");
    expect(serverGet).toHaveBeenCalledWith(
      "/api/it/tickets/{display_id}",
      { display_id: "INC0001056" },
      { origin: "http://o", cookie: "c=1" },
    );
    expect(screen.getByRole("heading", { level: 1, name: "Red lenta" })).toBeTruthy();
    expect(screen.getByText("Pendiente")).toBeTruthy();
    expect(screen.getAllByText("INC0001056")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Seguimiento de tickets" })).toBeTruthy();
  });

  it("an unknown id is the not-found screen and other failures go to the retry boundary", async () => {
    serverGet.mockResolvedValue({ ok: false, status: 404 });
    await expect(TiTicketPage({ params: Promise.resolve({ id: "INC0009999" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    serverGet.mockResolvedValue({ ok: false, status: 500 });
    await expect(TiTicketPage({ params: Promise.resolve({ id: "INC0001056" }) })).rejects.toThrow(/500/);
  });
});
