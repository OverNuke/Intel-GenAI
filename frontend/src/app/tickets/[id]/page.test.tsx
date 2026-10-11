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

import TicketDetailPage from "./page";

const ana = { id: "ana", name: "Ana Ruiz", email: "ana.ruiz@ejemplo.mx", area: "Finanzas", role: "user" };
const ticket = {
  id: "INC0001056",
  summary: "Red lenta en toda el área de captura",
  service: "network",
  service_label: "Red e internet",
  status: "in_progress",
  awaiting_user: true,
  via_ariadna: false,
  asset: null,
  created_at: "2026-01-08T17:00:00Z",
  updated_at: "2026-01-08T20:00:00Z",
  description: "Las páginas tardan.",
  impact: "high",
  urgency: "high",
  assigned_group: "Soporte TI",
  assignee_name: "Luis Herrera",
  events: [],
  contact_notice: "Confirma la extensión",
  receipt: null,
};

beforeEach(() => {
  requireAccess.mockReset();
  serverGet.mockReset();
  notFound.mockClear();
  requireAccess.mockResolvedValue({ kind: "allowed", user: ana, section: { key: "my-tickets", label: "Mis tickets" } });
});
afterEach(cleanup);

describe("/tickets/[id] (U3)", () => {
  it("awaits params, guards 'my-tickets' and renders the detail inside the shell", async () => {
    serverGet.mockResolvedValue({ ok: true, data: ticket });
    render(await TicketDetailPage({ params: Promise.resolve({ id: "INC0001056" }) }));
    expect(requireAccess).toHaveBeenCalledWith("my-tickets");
    expect(serverGet).toHaveBeenCalledWith(
      "/api/tickets/{display_id}",
      { display_id: "INC0001056" },
      { origin: "http://o", cookie: "c=1" },
    );
    expect(screen.getByRole("heading", { level: 1, name: "Red lenta en toda el área de captura" })).toBeTruthy();
    expect(screen.getByText("Confirma la extensión")).toBeTruthy();
  });

  it("S-UT-14: a 404 from the API becomes the not-found screen", async () => {
    serverGet.mockResolvedValue({ ok: false, status: 404 });
    await expect(TicketDetailPage({ params: Promise.resolve({ id: "INC0009999" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("other failures throw so the error boundary can offer a retry", async () => {
    serverGet.mockResolvedValue({ ok: false, status: 503 });
    await expect(TicketDetailPage({ params: Promise.resolve({ id: "INC0001056" }) })).rejects.toThrow(/503/);
    expect(notFound).not.toHaveBeenCalled();
  });
});
