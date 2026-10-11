// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAccess, serverGet, redirect } = vi.hoisted(() => ({
  requireAccess: vi.fn(),
  serverGet: vi.fn(),
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/guard", () => ({ requireAccess }));
vi.mock("@/lib/server-context", () => ({ readServerContext: async () => ({ origin: "http://o", cookie: "c=1" }) }));
vi.mock("@/lib/server-api", () => ({ serverGet }));
vi.mock("next/navigation", () => ({ redirect, useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

import ConversacionPage from "./page";

const ana = { id: "ana", name: "Ana Ruiz", email: "ana.ruiz@ejemplo.mx", area: "Finanzas", role: "user" };
const catalog = [
  {
    key: "network",
    label: "Red e internet",
    description: "Wi-Fi, VPN y conexión",
    examples: [],
    have_at_hand: [],
    handled_by: "Soporte de redes",
    requires_manager_authorization: false,
  },
];
const ticket = { id: "INC0001056", summary: "Red lenta en toda el área de captura" };

const search = (q: Record<string, string | string[]>) => Promise.resolve(q);

beforeEach(() => {
  requireAccess.mockReset();
  serverGet.mockReset();
  redirect.mockClear();
  requireAccess.mockResolvedValue({ kind: "allowed", user: ana, section: { key: "new-request", label: "x" } });
  serverGet.mockImplementation(async (path: string) => {
    if (path === "/api/catalog/services") return { ok: true, data: catalog };
    if (path === "/api/tickets/{display_id}") return { ok: true, data: ticket };
    return { ok: false, status: 404 };
  });
});
afterEach(cleanup);

describe("/solicitud/conversacion (U6)", () => {
  it("opens an unscoped conversation without parameters", async () => {
    render(await ConversacionPage({ searchParams: search({}) }));
    expect(requireAccess).toHaveBeenCalledWith("new-request");
    expect(screen.getByText("Hola, Ana. Cuéntame qué está pasando y te ayudo a preparar tu solicitud.")).toBeTruthy();
  });

  it("renders inside the chat shell: .is-chat root and a single Secciones nav as .islands, no rail (REQ-NS-5)", async () => {
    const { container } = render(await ConversacionPage({ searchParams: search({}) }));
    expect(container.querySelector(".app.is-chat")).not.toBeNull();
    const navs = screen.getAllByRole("navigation", { name: "Secciones" });
    expect(navs).toHaveLength(1);
    expect(navs[0]!.classList.contains("islands")).toBe(true);
    expect(container.querySelector(".rail")).toBeNull();
  });

  it("?servicio= opens the conversation scoped to a known service", async () => {
    render(await ConversacionPage({ searchParams: search({ servicio: "network" }) }));
    expect(screen.getByText("Elegiste «Red e internet». ¿Qué está pasando?")).toBeTruthy();
  });

  it("an unknown service goes back to U4", async () => {
    await expect(ConversacionPage({ searchParams: search({ servicio: "unknown-x" }) })).rejects.toThrow(
      "NEXT_REDIRECT:/solicitud",
    );
  });

  it("?ticket= scopes the help to an owned ticket", async () => {
    render(await ConversacionPage({ searchParams: search({ ticket: "INC0001056" }) }));
    expect(serverGet).toHaveBeenCalledWith(
      "/api/tickets/{display_id}",
      { display_id: "INC0001056" },
      { origin: "http://o", cookie: "c=1" },
    );
    expect(screen.getByText("Veo el ticket INC0001056. ¿Qué necesitas saber o agregar?")).toBeTruthy();
  });

  it("a ticket that is not yours (404) goes back to U4", async () => {
    serverGet.mockImplementation(async (path: string) =>
      path === "/api/catalog/services" ? { ok: true, data: catalog } : { ok: false, status: 404 },
    );
    await expect(ConversacionPage({ searchParams: search({ ticket: "INC0001053" }) })).rejects.toThrow(
      "NEXT_REDIRECT:/solicitud",
    );
  });
});
