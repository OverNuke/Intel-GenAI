import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "ariadna_session=abc" }),
}));

import { checkAccess, requireAccess } from "./guard";

const ctx = { origin: "http://127.0.0.1:8000", cookie: "ariadna_session=abc" };
const user = { id: "u1", name: "Ana", email: "ana@x.mx", area: "Finanzas", role: "user" };
const allowedBody = { allowed: true, user, section: { key: "home", label: "Inicio" } };
const deniedBody = {
  allowed: false,
  section: { key: "agent-tracking", label: "Seguimiento del agente" },
  required_role: { key: "supervisor", label: "Supervisor" },
};
const fetchOf = (res: Response | Error) =>
  vi.fn<typeof fetch>(async () => {
    if (res instanceof Error) throw res;
    return res;
  });

beforeEach(() => {
  redirectMock.mockClear();
});

describe("checkAccess", () => {
  it("returns allowed with the user on 200", async () => {
    const f = fetchOf(Response.json(allowedBody));
    expect(await checkAccess("home", ctx, f)).toEqual({ kind: "allowed", user, section: allowedBody.section });
    expect(f).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/auth/access?section=home",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("encodes the section in the query", async () => {
    const f = fetchOf(Response.json(deniedBody, { status: 403 }));
    await checkAccess("a b&c", ctx, f);
    expect(f.mock.calls[0]![0]).toBe("http://127.0.0.1:8000/api/auth/access?section=a%20b%26c");
  });

  it("returns denied with section and required role on 403", async () => {
    expect(await checkAccess("agent-tracking", ctx, fetchOf(Response.json(deniedBody, { status: 403 })))).toEqual({
      kind: "denied",
      section: deniedBody.section,
      required_role: deniedBody.required_role,
    });
  });

  it("returns unauthenticated only on a JSON 401", async () => {
    expect(
      await checkAccess("home", ctx, fetchOf(Response.json({ detail: "No hay una sesión activa." }, { status: 401 }))),
    ).toEqual({ kind: "unauthenticated" });
  });

  it("throws on a non-JSON 401 (e.g. deployment protection page)", async () => {
    await expect(checkAccess("home", ctx, fetchOf(new Response("<html>sso</html>", { status: 401 })))).rejects.toThrow();
  });

  it("throws when there is no response (status 0)", async () => {
    await expect(checkAccess("home", ctx, fetchOf(new TypeError("fetch failed")))).rejects.toThrow();
  });

  it("throws on 5xx, even with a JSON body", async () => {
    await expect(checkAccess("home", ctx, fetchOf(Response.json({ detail: "x" }, { status: 503 })))).rejects.toThrow(/503/);
  });

  it("throws on a 200 with a non-JSON body", async () => {
    await expect(checkAccess("home", ctx, fetchOf(new Response("<html>", { status: 200 })))).rejects.toThrow();
  });
});

describe("requireAccess", () => {
  it("returns the user when allowed and does not redirect", async () => {
    const result = await requireAccess("home", fetchOf(Response.json(allowedBody)));
    expect(result.user).toEqual(user);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /entrar on a JSON 401 and lets the redirect propagate", async () => {
    await expect(requireAccess("home", fetchOf(Response.json({ detail: "x" }, { status: 401 })))).rejects.toThrow(
      "NEXT_REDIRECT:/entrar",
    );
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });

  it("redirects denied users to /sin-acceso with section and required role", async () => {
    await expect(requireAccess("agent-tracking", fetchOf(Response.json(deniedBody, { status: 403 })))).rejects.toThrow(
      "NEXT_REDIRECT:/sin-acceso?section=agent-tracking&required=supervisor",
    );
  });

  it("throws the outage error (no redirect, no loop) when the backend is unreachable or 5xx", async () => {
    await expect(requireAccess("home", fetchOf(new TypeError("fetch failed")))).rejects.toThrow(/access check/i);
    await expect(requireAccess("home", fetchOf(new Response("boom", { status: 502 })))).rejects.toThrow(/502/);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
