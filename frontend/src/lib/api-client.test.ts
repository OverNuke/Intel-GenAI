import { describe, expect, it, vi } from "vitest";
import { apiGet, apiPatch, apiPost } from "./api-client";

function fakeFetch(response: Response | Error) {
  return vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
}

describe("apiGet", () => {
  it("returns typed data on 200", async () => {
    const f = fakeFetch(Response.json({ status: "ok" }));
    const result = await apiGet("/api/health", f);
    expect(result).toEqual({ ok: true, data: { status: "ok" } });
    expect(f).toHaveBeenCalledWith("/api/health", { headers: { Accept: "application/json" } });
  });

  it("returns {ok:false,status} on 500 without throwing", async () => {
    const result = await apiGet("/api/health", fakeFetch(new Response("boom", { status: 500 })));
    expect(result).toEqual({ ok: false, status: 500 });
  });

  it("returns {ok:false,status:0} on network failure", async () => {
    const result = await apiGet("/api/health", fakeFetch(new TypeError("network")));
    expect(result).toEqual({ ok: false, status: 0 });
  });

  it("returns {ok:false} when a 200 body is not JSON", async () => {
    const result = await apiGet("/api/health", fakeFetch(new Response("<html>", { status: 200 })));
    expect(result).toEqual({ ok: false, status: 200 });
  });
});

describe("apiGet options", () => {
  it("keeps the (path, fetchImpl) call shape and sends no extra init keys by default", async () => {
    const f = fakeFetch(Response.json({ status: "ok" }));
    await apiGet("/api/health", f);
    expect(f).toHaveBeenCalledWith("/api/health", { headers: { Accept: "application/json" } });
  });

  it("prefixes baseUrl, merges headers and forwards cache", async () => {
    const f = fakeFetch(Response.json([]));
    await apiGet("/api/auth/accounts", f, {
      baseUrl: "http://127.0.0.1:8000",
      headers: { Cookie: "ariadna_session=abc" },
      cache: "no-store",
    });
    expect(f).toHaveBeenCalledWith("http://127.0.0.1:8000/api/auth/accounts", {
      headers: { Accept: "application/json", Cookie: "ariadna_session=abc" },
      cache: "no-store",
    });
  });
});

describe("apiPost", () => {
  const user = { id: "u1", name: "Ana", email: "ana@x.mx", area: "Compras", role: "user" } as const;

  it("POSTs a JSON body and returns typed data on 200", async () => {
    const f = fakeFetch(Response.json(user));
    const result = await apiPost("/api/auth/login", { method: "account", email: "ana@x.mx" }, f);
    expect(result).toEqual({ ok: true, data: user });
    expect(f).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ method: "account", email: "ana@x.mx" }),
    });
  });

  it("exposes the typed 400 field errors body", async () => {
    const body = { errors: [{ field: "email", code: "required" }] };
    const result = await apiPost("/api/auth/login", { method: "credentials" }, fakeFetch(Response.json(body, { status: 400 })));
    expect(result).toEqual({ ok: false, status: 400, error: body });
  });

  it("exposes the typed 401 body", async () => {
    const body = { errors: [{ field: "form", code: "invalid_credentials" }] };
    const result = await apiPost("/api/auth/login", { method: "credentials", email: "a@b.mx", password: "x" }, fakeFetch(Response.json(body, { status: 401 })));
    expect(result).toEqual({ ok: false, status: 401, error: body });
  });

  it("returns {ok:false,status} without error when a 400 body is not JSON", async () => {
    const result = await apiPost("/api/auth/login", {}, fakeFetch(new Response("<html>", { status: 400 })));
    expect(result).toEqual({ ok: false, status: 400 });
  });

  it("returns no error body on 500 and status 0 on network failure", async () => {
    expect(await apiPost("/api/auth/login", {}, fakeFetch(Response.json({ errors: [] }, { status: 500 })))).toEqual({ ok: false, status: 500 });
    expect(await apiPost("/api/auth/login", {}, fakeFetch(new TypeError("network")))).toEqual({ ok: false, status: 0 });
  });

  it("prefixes baseUrl and merges headers", async () => {
    const f = fakeFetch(new Response(null, { status: 204 }));
    await apiPost("/api/auth/logout", undefined, f, { baseUrl: "http://x", headers: { Cookie: "c=1" } });
    expect(f).toHaveBeenCalledWith("http://x/api/auth/logout", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Cookie: "c=1" },
    });
  });
});

describe("path params and query", () => {
  it("fills {display_id} (URL-encoded) and appends the query string", async () => {
    const f = fakeFetch(Response.json({}));
    await apiGet("/api/tickets/{display_id}", f, {
      params: { display_id: "INC 0001056/x" },
      query: { periodo: "7" },
    });
    expect(f).toHaveBeenCalledWith("/api/tickets/INC%200001056%2Fx?periodo=7", {
      headers: { Accept: "application/json" },
    });
  });

  it("leaves a path without placeholders untouched", async () => {
    const f = fakeFetch(Response.json({}));
    await apiGet("/api/tickets/mine", f, { params: { unused: "1" } });
    expect(f).toHaveBeenCalledWith("/api/tickets/mine", { headers: { Accept: "application/json" } });
  });
});

describe("apiPost ticket submission", () => {
  it("sends the typed submit body and returns the created ticket (201 is ok)", async () => {
    const created = { id: "INC0001061" };
    const f = fakeFetch(Response.json(created, { status: 201 }));
    const result = await apiPost(
      "/api/tickets",
      {
        draft: { service: "printing", summary: "La impresora no imprime", description: "En cola" },
        confirmed: true,
        idempotency_key: "k-1",
      },
      f,
    );
    expect(result).toEqual({ ok: true, data: created });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      draft: { service: "printing", summary: "La impresora no imprime", description: "En cola" },
      confirmed: true,
      idempotency_key: "k-1",
    });
  });

  it("surfaces a 422 as ok:false with the status so the UI keeps the draft", async () => {
    const f = fakeFetch(Response.json({ reason: "incomplete-draft" }, { status: 422 }));
    const result = await apiPost(
      "/api/tickets",
      { draft: { service: "printing", summary: " ", description: "x" }, confirmed: true },
      f,
    );
    expect(result).toMatchObject({ ok: false, status: 422 });
  });
});

describe("abort signal", () => {
  it("forwards a signal to fetch so callers can enforce a timeout", async () => {
    const f = fakeFetch(Response.json({}));
    const controller = new AbortController();
    await apiPost("/api/auth/login", { method: "account", email: "a@b.mx" }, f, { signal: controller.signal });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it("an aborted request resolves to {ok:false,status:0} instead of throwing", async () => {
    const f = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    const result = await apiPost("/api/auth/login", { method: "account", email: "a@b.mx" }, f);
    expect(result).toEqual({ ok: false, status: 0 });
  });
});

describe("write errors (403/404/409/422)", () => {
  const body = { reason: "not-resolved", message: "El ticket todavía no está resuelto." };

  it.each([403, 404, 409, 422])("exposes the JSON error body on %i", async (status) => {
    const result = await apiPost(
      "/api/tickets/{display_id}/close",
      { confirmed: true },
      fakeFetch(Response.json(body, { status })),
      { params: { display_id: "INC0001056" } },
    );
    expect(result).toEqual({ ok: false, status, error: body });
  });

  it("still returns no error when a 409 body is not JSON", async () => {
    const result = await apiPost(
      "/api/tickets/{display_id}/close",
      { confirmed: true },
      fakeFetch(new Response("<html>", { status: 409 })),
      { params: { display_id: "INC0001056" } },
    );
    expect(result).toEqual({ ok: false, status: 409 });
  });
});

describe("apiPatch", () => {
  it("PATCHes a JSON body to the templated path and returns data", async () => {
    const f = fakeFetch(Response.json({ id: "INC0001056" }));
    const result = await apiPatch(
      "/api/tickets/{display_id}",
      { urgency: "high", confirmed: true },
      f,
      { params: { display_id: "INC0001056" } },
    );
    expect(result).toEqual({ ok: true, data: { id: "INC0001056" } });
    expect(f).toHaveBeenCalledWith("/api/tickets/INC0001056", {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ urgency: "high", confirmed: true }),
    });
  });

  it("exposes the 422 body and never throws on network failure", async () => {
    const body = { reason: "no-changes", message: "No hay cambios." };
    const bad = await apiPatch("/api/tickets/{display_id}", { confirmed: true }, fakeFetch(Response.json(body, { status: 422 })), {
      params: { display_id: "INC0001056" },
    });
    expect(bad).toEqual({ ok: false, status: 422, error: body });
    const down = await apiPatch("/api/tickets/{display_id}", { confirmed: true }, fakeFetch(new TypeError("net")), {
      params: { display_id: "INC0001056" },
    });
    expect(down).toEqual({ ok: false, status: 0 });
  });
});
