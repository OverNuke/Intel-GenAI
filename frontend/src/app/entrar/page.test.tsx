// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAccounts } = vi.hoisted(() => ({ fetchAccounts: vi.fn() }));
vi.mock("@/lib/accounts", () => ({ fetchAccounts }));
vi.mock("@/lib/server-context", () => ({ readServerContext: async () => ({ origin: "http://o", cookie: null }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import EntrarPage from "./page";

beforeEach(() => {
  fetchAccounts.mockReset();
});
afterEach(cleanup);

describe("/entrar page", () => {
  it("renders the form with the picker enabled when accounts load", async () => {
    fetchAccounts.mockResolvedValue([{ id: "1", name: "Ana Ruiz", email: "ana.ruiz@ejemplo.mx", area: "Finanzas", role: "user" }]);
    render(await EntrarPage());
    expect(screen.getByRole("heading", { level: 1, name: "Inicia sesión" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Entrar con la cuenta de la organización" }).getAttribute("aria-disabled")).toBeNull();
    expect(screen.getByText("Prototipo académico. Datos de ejemplo.")).toBeTruthy();
  });

  it("shows a brand-only aside: dashed logo slot, wordmark, tagline, banner", async () => {
    fetchAccounts.mockResolvedValue([]);
    const { container } = render(await EntrarPage());
    const aside = container.querySelector("aside.brand-aside")!;
    expect(aside.querySelector(".logo-slot")?.getAttribute("aria-hidden")).toBe("true");
    expect(aside.textContent).toContain("Ariadna");
    expect(aside.textContent).toContain("Tu guía para solicitudes de TI");
    expect(aside.querySelector("img, picture, video")).toBeNull();
  });

  it("still renders the form (picker disabled, notice shown) when the accounts request fails", async () => {
    fetchAccounts.mockRejectedValue(new Error("Accounts request failed (status 503)."));
    render(await EntrarPage());
    expect(screen.getByRole("heading", { level: 1, name: "Inicia sesión" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Entrar con la cuenta de la organización" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(/No pudimos cargar las cuentas de ejemplo/)).toBeTruthy();
    expect(screen.getByLabelText("Correo institucional")).toBeTruthy();
  });
});
