// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAccess, serverGet } = vi.hoisted(() => ({ requireAccess: vi.fn(), serverGet: vi.fn() }));
vi.mock("@/lib/guard", () => ({ requireAccess }));
vi.mock("@/lib/server-context", () => ({ readServerContext: async () => ({ origin: "http://o", cookie: "c=1" }) }));
vi.mock("@/lib/server-api", () => ({ serverGet }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import SolicitudPage from "./page";

const luis = { id: "luis", name: "Luis Herrera", email: "luis.herrera@ejemplo.mx", area: "Mesa de ayuda", role: "it" };
const service = {
  key: "network",
  label: "Red e internet",
  description: "Wi-Fi, VPN y conexión",
  examples: ["No conecta la VPN"],
  have_at_hand: ["Dónde estás: en la oficina o en casa."],
  handled_by: "Soporte de redes",
  requires_manager_authorization: false,
};

beforeEach(() => {
  requireAccess.mockReset();
  serverGet.mockReset();
  requireAccess.mockResolvedValue({ kind: "allowed", user: luis, section: { key: "new-request", label: "¿Qué necesitas?" } });
});
afterEach(cleanup);

describe("/solicitud (U4)", () => {
  it("guards 'new-request', reads the catalog and renders it in the shell for any role", async () => {
    serverGet.mockResolvedValue({ ok: true, data: [service] });
    render(await SolicitudPage());
    expect(requireAccess).toHaveBeenCalledWith("new-request");
    expect(serverGet).toHaveBeenCalledWith("/api/catalog/services", undefined, { origin: "http://o", cookie: "c=1" });
    expect(screen.getByRole("heading", { level: 2, name: "Red e internet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "¿Qué necesitas?" }).getAttribute("aria-current")).toBe("page");
  });

  it("throws on a backend failure so the error boundary offers a retry", async () => {
    serverGet.mockResolvedValue({ ok: false, status: 500 });
    await expect(SolicitudPage()).rejects.toThrow(/500/);
  });
});
