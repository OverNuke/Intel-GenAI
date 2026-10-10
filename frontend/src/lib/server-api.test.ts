import { describe, expect, it, vi } from "vitest";
import { resolveApiOrigin, serverFetch } from "./server-api";

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
