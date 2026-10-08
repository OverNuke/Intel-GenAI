import { describe, expect, it } from "vitest";
import { devApiRewrites } from "./dev-proxy";

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
