import { DEV_BACKEND_ORIGIN } from "./dev-proxy";

type HeaderReader = { get(name: string): string | null };
type ServerEnv = { API_ORIGIN?: string; NODE_ENV?: string };

export type ServerContext = { origin: string; cookie: string | null };

/**
 * Absolute backend origin for server-side fetches (Node fetch has no base URL).
 * API_ORIGIN first; dev fallback to the local FastAPI; production fallback to the request origin.
 */
export function resolveApiOrigin(env: ServerEnv, requestHeaders: HeaderReader): string {
  const configured = env.API_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (env.NODE_ENV !== "production") return DEV_BACKEND_ORIGIN;
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) throw new Error("Cannot determine the backend origin: set API_ORIGIN.");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Server-side backend call: absolute URL, incoming cookie forwarded by hand, never cached. */
export function serverFetch(path: string, ctx: ServerContext, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (ctx.cookie) headers.Cookie = ctx.cookie;
  return fetchImpl(`${ctx.origin}${path}`, { headers, cache: "no-store" });
}
