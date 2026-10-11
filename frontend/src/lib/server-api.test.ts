import { describe, expect, it, vi } from "vitest";
import { resolveApiOrigin, serverFetch, serverGet } from "./server-api";

const headers = (entries: Record<string, string>) => ({
  get: (name: string) => entries[name.toLowerCase()] ?? null,
});

describe("resolveApiOrigin", () => {
  it("prefers API_ORIGIN and trims a trailing slash", () => {
    expect(
      resolveApiOrigin({ API_ORIGIN: "https://api.example.mx/", NODE_ENV: "production" }, headers({ host: "x.vercel.app" })),
    ).toBe("https://api.example.mx");
  });

  it("falls back to the local backend outside production", () => {
    expect(resolveApiOrigin({ NODE_ENV: "development" }, headers({}))).toBe("http://127.0.0.1:8000");
    expect(resolveApiOrigin({}, headers({}))).toBe("http://127.0.0.1:8000");
  });

  it("derives the origin from forwarded headers in production", () => {
    expect(
      resolveApiOrigin(
        { NODE_ENV: "production" },
        headers({ "x-forwarded-proto": "https", "x-forwarded-host": "ariadna.vercel.app", host: "internal" }),
      ),
    ).toBe("https://ariadna.vercel.app");
  });

  it("uses host and defaults to https in production without forwarded headers", () => {
    expect(resolveApiOrigin({ NODE_ENV: "production" }, headers({ host: "ariadna.vercel.app" }))).toBe(
      "https://ariadna.vercel.app",
    );
  });

  it("throws in production when no origin can be determined", () => {
    expect(() => resolveApiOrigin({ NODE_ENV: "production" }, headers({}))).toThrow(/API_ORIGIN/);
  });
});

describe("serverFetch", () => {
  it("calls the absolute URL, forwards the cookie and disables caching", async () => {
    const f = vi.fn(async () => Response.json({}));
    await serverFetch("/api/auth/access?section=home", { origin: "http://127.0.0.1:8000", cookie: "ariadna_session=abc" }, f);
    expect(f).toHaveBeenCalledWith("http://127.0.0.1:8000/api/auth/access?section=home", {
      headers: { Accept: "application/json", Cookie: "ariadna_session=abc" },
      cache: "no-store",
    });
  });

  it("omits the Cookie header when the request had none", async () => {
    const f = vi.fn(async () => Response.json({}));
    await serverFetch("/api/auth/access?section=home", { origin: "http://o", cookie: null }, f);
    expect(f).toHaveBeenCalledWith("http://o/api/auth/access?section=home", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  });
});

describe("serverGet", () => {
  it("fills path params, forwards the cookie and calls the absolute URL uncached", async () => {
    const f = vi.fn(async () => Response.json({ id: "INC0001056" }));
    const ctx = { origin: "http://127.0.0.1:8000", cookie: "ariadna_session=abc" };
    const result = await serverGet("/api/tickets/{display_id}", { display_id: "INC0001056" }, ctx, f);
    expect(result).toEqual({ ok: true, data: { id: "INC0001056" } });
    expect(f).toHaveBeenCalledWith("http://127.0.0.1:8000/api/tickets/INC0001056", {
      headers: { Accept: "application/json", Cookie: "ariadna_session=abc" },
      cache: "no-store",
    });
  });

  it("omits the Cookie header without a session and surfaces a 404 as ok:false", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 404 }));
    const result = await serverGet("/api/tickets/mine", undefined, { origin: "http://o", cookie: null }, f);
    expect(result).toEqual({ ok: false, status: 404 });
    expect(f).toHaveBeenCalledWith("http://o/api/tickets/mine", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  });
});
