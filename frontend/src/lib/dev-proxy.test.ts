import { describe, expect, it } from "vitest";
import { DEV_BACKEND_ORIGIN, devApiRewrites } from "./dev-proxy";

describe("devApiRewrites", () => {
  it("proxies /api to the local backend in development", () => {
    expect(devApiRewrites("development")).toEqual([
      { source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" },
    ]);
  });

  it("proxies in any non-production env (test)", () => {
    expect(devApiRewrites("test")).toHaveLength(1);
  });

  it("returns no rewrites in production", () => {
    expect(devApiRewrites("production")).toEqual([]);
  });
});

describe("devApiRewrites API_ORIGIN override", () => {
  it("uses the given origin", () => {
    expect(devApiRewrites("development", "http://backend:8000")).toEqual([
      { source: "/api/:path*", destination: "http://backend:8000/api/:path*" },
    ]);
  });

  it("trims trailing slashes", () => {
    const [rule] = devApiRewrites("development", "http://backend:8000/");
    expect(rule!.destination).toBe("http://backend:8000/api/:path*");
  });

  it("falls back to the default when blank", () => {
    const [rule] = devApiRewrites("development", "   ");
    expect(rule!.destination).toBe("http://127.0.0.1:8000/api/:path*");
  });

  it("ignores the override in production", () => {
    expect(devApiRewrites("production", "http://backend:8000")).toEqual([]);
  });

  it("stays a plain proxy with the override", () => {
    const [rule] = devApiRewrites("development", "http://backend:8000");
    expect(Object.keys(rule!).sort()).toEqual(["destination", "source"]);
  });
});

describe("devApiRewrites cookie passthrough", () => {
  it("is a plain proxy: no header rules that could drop Set-Cookie, same origin as the server-side fallback", () => {
    const [rule] = devApiRewrites("development");
    expect(Object.keys(rule!).sort()).toEqual(["destination", "source"]);
    expect(rule!.destination.startsWith(DEV_BACKEND_ORIGIN)).toBe(true);
    expect(DEV_BACKEND_ORIGIN).toBe("http://127.0.0.1:8000");
  });
});
