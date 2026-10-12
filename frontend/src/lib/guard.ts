import { redirect } from "next/navigation";
import { sinAccesoHref } from "./access-labels";
import type { components } from "./api-types";
import { serverFetch, type ServerContext } from "./server-api";
import { readServerContext } from "./server-context";
import { unauthenticatedHref } from "./session-cookie";

type Schemas = components["schemas"];
type User = Schemas["UserOut"];
type Section = Schemas["SectionOut"];

export type AccessDecision =
  | { kind: "allowed"; user: User; section: Section }
  | { kind: "denied"; section: Section; required_role: Schemas["RoleOut"] | null }
  | { kind: "unauthenticated" };

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Asks the backend whether the incoming session may open `section`.
 * Only a JSON 401 means "no session". No response, 5xx or a non-JSON body (an outage or a
 * platform page) throws, so an outage can never bounce users between /entrar and the guard.
 */
export async function checkAccess(
  section: string,
  ctx: ServerContext,
  fetchImpl: typeof fetch = fetch,
): Promise<AccessDecision> {
  let response: Response;
  try {
    response = await serverFetch(`/api/auth/access?section=${encodeURIComponent(section)}`, ctx, fetchImpl);
  } catch (cause) {
    throw new Error("Access check failed: no response from the backend.", { cause });
  }
  const body = await readJson(response);
  if (body === undefined || body === null || typeof body !== "object") {
    throw new Error(`Access check failed: non-JSON answer (${response.status}).`);
  }
  if (response.status === 200) {
    const allowed = body as Schemas["AccessAllowed"];
    return { kind: "allowed", user: allowed.user, section: allowed.section };
  }
  if (response.status === 403) {
    const denied = body as Schemas["AccessDenied"];
    return { kind: "denied", section: denied.section, required_role: denied.required_role };
  }
  if (response.status === 401) return { kind: "unauthenticated" };
  throw new Error(`Access check failed: unexpected status ${response.status}.`);
}

/** Server-component guard. `redirect()` throws by design, so it is called outside any try/catch. */
export async function requireAccess(
  section: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Extract<AccessDecision, { kind: "allowed" }>> {
  const ctx = await readServerContext();
  const decision = await checkAccess(section, ctx, fetchImpl);
  if (decision.kind === "unauthenticated") redirect(unauthenticatedHref(ctx.cookie));
  if (decision.kind === "denied") redirect(sinAccesoHref(decision));
  return decision;
}
