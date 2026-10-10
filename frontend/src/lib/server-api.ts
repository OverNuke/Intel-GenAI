import { apiGet, type ApiResult, type GetPaths, type GetResponse, type RequestOptions } from "./api-client";
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

/**
 * Typed server-side GET: fills `{param}` placeholders, forwards the session cookie and never
 * caches. Resolves to `{ok:false,status}` on 4xx/5xx (callers decide: notFound, error, redirect).
 */
export function serverGet<P extends GetPaths>(
  path: P,
  params: Record<string, string> | undefined,
  ctx: ServerContext,
  fetchImpl: typeof fetch = fetch,
  query?: Record<string, string>,
): Promise<ApiResult<GetResponse<P>>> {
  const headers: Record<string, string> = {};
  if (ctx.cookie) headers.Cookie = ctx.cookie;
  const options: RequestOptions = { baseUrl: ctx.origin, headers, cache: "no-store" };
  if (params) options.params = params;
  if (query) options.query = query;
  return apiGet(path, fetchImpl, options);
}
