// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAccess } = vi.hoisted(() => ({ requireAccess: vi.fn() }));
vi.mock("@/lib/guard", () => ({ requireAccess }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import RegistroPage from "./page";
import CierrePage from "../cierre/page";

const luis = { id: "luis", name: "Luis Herrera", email: "luis.herrera@ejemplo.mx", area: "Mesa de ayuda", role: "it" };

beforeEach(() => {
  requireAccess.mockReset();
  requireAccess.mockResolvedValue({ kind: "allowed", user: luis, section: { key: "registry", label: "Registro" } });
});
afterEach(cleanup);

describe("registry and closure placeholders (S-AS-5)", () => {
  it("IT sees a minimal placeholder for Registro", async () => {
    render(await RegistroPage());
    expect(requireAccess).toHaveBeenCalledWith("registry");
    expect(screen.getByRole("heading", { level: 1, name: "Registro" })).toBeTruthy();
    expect(screen.getAllByText("Próxima etapa del prototipo").length).toBeGreaterThan(0);
  });

  it("IT sees a minimal placeholder for Cierre", async () => {
    render(await CierrePage());
    expect(requireAccess).toHaveBeenCalledWith("closure");
    expect(screen.getByRole("heading", { level: 1, name: "Cierre" })).toBeTruthy();
  });

  it("other roles never get past the guard (it redirects to A3)", async () => {
    requireAccess.mockRejectedValue(new Error("NEXT_REDIRECT:/sin-acceso?section=registry&required=it"));
    await expect(RegistroPage()).rejects.toThrow("NEXT_REDIRECT");
  });
});
