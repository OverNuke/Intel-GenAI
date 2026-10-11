// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { LogoutButton } from "./logout-button";

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function click(fetchMock: typeof fetch) {
  vi.stubGlobal("fetch", fetchMock);
  render(<LogoutButton />);
  fireEvent.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));
}

describe("LogoutButton", () => {
  it("shows a decorative log-out icon next to the unchanged accessible name", () => {
    render(<LogoutButton />);
    const item = screen.getByRole("menuitem", { name: "Cerrar sesión" });
    const icon = item.querySelector('svg[data-icon="log-out"]');
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(item.textContent).toBe("Cerrar sesión");
  });

  it("S-A4-1: POSTs /api/auth/logout, then replaces with A4 and refreshes", async () => {
    const f = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    click(f);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sesion-cerrada"));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0]![0]).toBe("/api/auth/logout");
    expect((f.mock.calls[0]![1] as RequestInit).method).toBe("POST");
  });

  it("S-A4-4: still lands on A4 when the request fails (network)", async () => {
    click(vi.fn<typeof fetch>(async () => { throw new TypeError("offline"); }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sesion-cerrada"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("still lands on A4 when the server answers 500", async () => {
    click(vi.fn<typeof fetch>(async () => new Response("boom", { status: 500 })));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sesion-cerrada"));
  });
});
