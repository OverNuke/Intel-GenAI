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

describe("devApiRewrites cookie passthrough", () => {
  it("is a plain proxy: no header rules that could drop Set-Cookie, same origin as the server-side fallback", () => {
    const [rule] = devApiRewrites("development");
    expect(Object.keys(rule!).sort()).toEqual(["destination", "source"]);
    expect(rule!.destination.startsWith(DEV_BACKEND_ORIGIN)).toBe(true);
    expect(DEV_BACKEND_ORIGIN).toBe("http://127.0.0.1:8000");
  });
});
