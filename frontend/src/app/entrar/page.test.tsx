// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("lays out .auth > aside.auth-aside + main.auth-main > .auth-card (REQ-A1-M6)", async () => {
    fetchAccounts.mockResolvedValue([]);
    const { container } = render(await EntrarPage());
    const auth = container.querySelector(".auth")!;
    expect(auth).not.toBeNull();
    const aside = container.querySelector(".auth > aside.auth-aside")!;
    expect(aside).not.toBeNull();
    expect(aside.nextElementSibling?.matches("main.auth-main")).toBe(true);
    expect(container.querySelector(".auth > main.auth-main > .auth-card h1")?.textContent).toBe("Inicia sesión");
    expect(container.querySelector(".split-page, .brand-aside, .split-main")).toBeNull();
  });

  it("shows a brand-only aside: product name, tagline, banner, no illustration (REQ-A1-M7)", async () => {
    fetchAccounts.mockResolvedValue([]);
    const { container } = render(await EntrarPage());
    const aside = container.querySelector("aside.auth-aside")!;
    expect(aside.textContent).toContain("Ariadna");
    expect(aside.textContent).toContain("Prototipo académico. Datos de ejemplo.");
    expect(aside.querySelector("img, picture, video")).toBeNull();
  });

  it("brands the aside with the Ariadna mark instead of a dashed logo slot", async () => {
    fetchAccounts.mockResolvedValue([]);
    const { container } = render(await EntrarPage());
    const aside = container.querySelector("aside.auth-aside")!;
    expect(container.querySelector(".logo-slot")).toBeNull();
    const mark = aside.querySelector("svg.ariadna-mark")!;
    expect(mark).not.toBeNull();
    expect(mark.getAttribute("aria-hidden")).toBe("true");
  });

  it("A2 chooser: info note alert, no primary button, ghost «Usar otra cuenta» (REQ-A2-M1)", async () => {
    fetchAccounts.mockResolvedValue([{ id: "1", name: "Ana Ruiz", email: "ana.ruiz@ejemplo.mx", area: "Finanzas", role: "user" }]);
    const { container } = render(await EntrarPage());
    fireEvent.click(screen.getByRole("button", { name: "Entrar con la cuenta de la organización" }));
    const note = screen.getByRole("note");
    expect(note.classList.contains("alert")).toBe(true);
    expect(note.classList.contains("tone-info")).toBe(true);
    expect(note.querySelector('svg[data-icon="info"]')).not.toBeNull();
    expect(container.querySelector(".btn-primary")).toBeNull();
    expect(screen.getByRole("button", { name: "Usar otra cuenta" }).classList.contains("btn-ghost")).toBe(true);
    const row = screen.getByRole("button", { name: /Ana Ruiz/ });
    expect(row.querySelector(".account-avatar")?.textContent).toBe("AR");
    expect(row.textContent).toContain("ana.ruiz@ejemplo.mx · Finanzas");
    expect(row.textContent).toContain("Usuario");
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
