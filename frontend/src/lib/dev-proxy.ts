export type Rewrite = { source: string; destination: string };

/** Local FastAPI origin. Shared with server-api.ts as the dev fallback for server-side fetches. */
export const DEV_BACKEND_ORIGIN = "http://127.0.0.1:8000";

/**
 * Dev-only rewrite of /api to the local FastAPI. In production, Vercel services route /api.
 * Kept a plain proxy on purpose: Next forwards the upstream response headers untouched, so the
 * backend's Set-Cookie (login/logout) reaches the browser. Do not add header rules here.
 */
export function devApiRewrites(nodeEnv: string | undefined, apiOrigin?: string): Rewrite[] {
  if (nodeEnv === "production") return [];
  const origin = apiOrigin?.trim().replace(/\/+$/, "") || DEV_BACKEND_ORIGIN;
  return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
}
