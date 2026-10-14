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

import EmailPage from "./page";

const luis = { id: "luis", name: "Luis Herrera", email: "luis.herrera@ejemplo.mx", area: "Mesa de ayuda", role: "it" };
const record = {
  id: "INC0001055",
  summary: "Red lenta",
  description: "Lenta.\nDesde ayer.",
  service: "network",
  service_label: "Red e internet",
  status: "new",
  awaiting_user: false,
  priority: "high",
  impact: "high",
  urgency: "high",
  assigned_group: "Soporte TI",
  assignee_name: null,
  requester_name: "Ana Ruiz",
  asset: null,
  via_ariadna: true,
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

describe("/ti/tickets/[id]/correo (T4)", () => {
  it("guards 'ticket-tracking', fetches the IT ticket and renders the email preview", async () => {
    serverGet.mockResolvedValue({ ok: true, data: record });
    const { container } = render(await EmailPage({ params: Promise.resolve({ id: "INC0001055" }) }));
    expect(requireAccess).toHaveBeenCalledWith("ticket-tracking");
    expect(serverGet).toHaveBeenCalledWith(
      "/api/it/tickets/{display_id}",
      { display_id: "INC0001055" },
      { origin: "http://o", cookie: "c=1" },
    );
    expect(screen.getByRole("heading", { level: 1, name: "Correo de aviso" })).toBeTruthy();
    expect(
      screen.getByText("El sistema lo envió al crear el ticket. Solo lo reciben las personas involucradas."),
    ).toBeTruthy();
    expect(screen.getByText("Nuevo ticket INC0001055: Red lenta")).toBeTruthy();
    expect(container.querySelector(".btn-primary")).toBeNull();
  });

  it("the page header goes back to the record by ticket id; no breadcrumb row", async () => {
    serverGet.mockResolvedValue({ ok: true, data: record });
    const { container } = render(await EmailPage({ params: Promise.resolve({ id: "INC0001055" }) }));
    const back = screen.getByRole("link", { name: "Volver a INC0001055" });
    expect(back.getAttribute("href")).toBe("/ti/tickets/INC0001055");
    expect(back.querySelector('svg[data-icon="arrow-left"]')).not.toBeNull();
    expect(container.querySelector(".crumb")).toBeNull();
    expect(container.querySelector(".page-head")).toBeNull();
    expect(container.querySelectorAll("header.page-header h1")).toHaveLength(1);
  });

  it("an unknown id is the not-found screen and other failures go to the retry boundary", async () => {
    serverGet.mockResolvedValue({ ok: false, status: 404 });
    await expect(EmailPage({ params: Promise.resolve({ id: "INC0009999" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    serverGet.mockResolvedValue({ ok: false, status: 500 });
    await expect(EmailPage({ params: Promise.resolve({ id: "INC0001055" }) })).rejects.toThrow(/500/);
  });

  it("a denied role never reaches the ticket API (the guard redirects)", async () => {
    requireAccess.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(EmailPage({ params: Promise.resolve({ id: "INC0001055" }) })).rejects.toThrow("NEXT_REDIRECT");
    expect(serverGet).not.toHaveBeenCalled();
  });
});
