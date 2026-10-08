import { describe, expect, it, vi } from "vitest";
import { apiGet } from "./api-client";

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
