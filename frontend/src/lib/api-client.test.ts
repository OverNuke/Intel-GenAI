import { describe, expect, it, vi } from "vitest";
import { apiGet, apiPost } from "./api-client";

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
