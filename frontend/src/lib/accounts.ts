import { apiGet } from "./api-client";
import type { components } from "./api-types";
import type { ServerContext } from "./server-api";

/** Demo accounts for the A2 picker, fetched server-side (never hardcoded in the frontend). */
export async function fetchAccounts(
  ctx: ServerContext,
  fetchImpl: typeof fetch = fetch,
): Promise<components["schemas"]["UserOut"][]> {
  const result = await apiGet("/api/auth/accounts", fetchImpl, { baseUrl: ctx.origin, cache: "no-store" });
  if (!result.ok) throw new Error(`Accounts request failed (status ${result.status}).`);
  return result.data;
}
