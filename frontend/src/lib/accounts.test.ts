import { describe, expect, it, vi } from "vitest";
import { fetchAccounts } from "./accounts";

const ctx = { origin: "http://127.0.0.1:8000", cookie: null };
const list = [{ id: "1", name: "Ana Ruiz", email: "ana.ruiz@ejemplo.mx", area: "Finanzas", role: "user" }];

describe("fetchAccounts", () => {
  it("returns the accounts from the backend (absolute URL, no cache)", async () => {
    const f = vi.fn<typeof fetch>(async () => Response.json(list));
    expect(await fetchAccounts(ctx, f)).toEqual(list);
    expect(f).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/auth/accounts",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws when the backend does not answer ok, so an outage is visible", async () => {
    await expect(fetchAccounts(ctx, vi.fn<typeof fetch>(async () => new Response("x", { status: 503 })))).rejects.toThrow(/503/);
    await expect(fetchAccounts(ctx, vi.fn<typeof fetch>(async () => { throw new TypeError("down"); }))).rejects.toThrow(/0/);
  });
});
