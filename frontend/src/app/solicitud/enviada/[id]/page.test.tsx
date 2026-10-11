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

import EnviadaPage from "./page";

const ana = { id: "ana", name: "Ana Ruiz", email: "ana.ruiz@ejemplo.mx", area: "Finanzas", role: "user" };
const ticket = {
  id: "INC0001061",
  summary: "La impresora no imprime",
  service: "printing",
  service_label: "Impresión",
  status: "new",
  awaiting_user: false,
  via_ariadna: false,
  asset: null,
  created_at: "2026-10-09T18:00:00Z",
  updated_at: "2026-10-09T18:00:00Z",
  description: "x",
  impact: "medium",
  urgency: "medium",
  assigned_group: "Soporte de impresión",
  assignee_name: null,
  events: [],
  contact_notice: null,
  receipt: null,
};

beforeEach(() => {
  requireAccess.mockReset();
  serverGet.mockReset();
  notFound.mockClear();
  requireAccess.mockResolvedValue({ kind: "allowed", user: ana, section: { key: "new-request", label: "x" } });
});
afterEach(cleanup);

describe("/solicitud/enviada/[id] (U7)", () => {
  it("S-TS-13: it only reads the ticket (a refresh never submits) and shows the confirmation", async () => {
    serverGet.mockResolvedValue({ ok: true, data: ticket });
    render(await EnviadaPage({ params: Promise.resolve({ id: "INC0001061" }) }));
    expect(requireAccess).toHaveBeenCalledWith("new-request");
    expect(serverGet).toHaveBeenCalledWith(
      "/api/tickets/{display_id}",
      { display_id: "INC0001061" },
      { origin: "http://o", cookie: "c=1" },
    );
    expect(screen.getByText("INC0001061")).toBeTruthy();
  });

  it("a ticket that is not yours is the not-found screen", async () => {
    serverGet.mockResolvedValue({ ok: false, status: 404 });
    await expect(EnviadaPage({ params: Promise.resolve({ id: "INC0001056" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("a backend failure throws for the error boundary", async () => {
    serverGet.mockResolvedValue({ ok: false, status: 500 });
    await expect(EnviadaPage({ params: Promise.resolve({ id: "INC0001061" }) })).rejects.toThrow(/500/);
  });
});
