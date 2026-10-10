// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { SignInContainer } from "./sign-in-container";

const luis = { id: "2", name: "Luis Herrera", email: "luis.herrera@ejemplo.mx", area: "Mesa de ayuda", role: "it" } as const;
const sara = { id: "3", name: "Sara Molina", email: "sara.molina@ejemplo.mx", area: "Supervisión", role: "supervisor" } as const;

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function pick(user: typeof luis | typeof sara) {
  const fetchMock = vi.fn<typeof fetch>(async () => Response.json(user));
  vi.stubGlobal("fetch", fetchMock);
  render(<SignInContainer accounts={[luis, sara]} />);
  fireEvent.click(screen.getByRole("button", { name: "Entrar con la cuenta de la organización" }));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(user.name) }));
  return fetchMock;
}

describe("SignInContainer", () => {
  it("posts the account email to /api/auth/login and goes to the TI start section", async () => {
    const fetchMock = pick(luis);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ti/seguimiento"));
    expect(refresh).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/auth/login");
    expect((fetchMock.mock.calls[0]![1] as RequestInit).body).toBe(JSON.stringify({ method: "account", email: luis.email }));
  });

  it("goes to the supervisor start section for a supervisor", async () => {
    pick(sara);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/supervisor/agente"));
  });
});
