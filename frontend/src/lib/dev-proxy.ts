export type Rewrite = { source: string; destination: string };

const BACKEND_ORIGIN = "http://127.0.0.1:8000";

/** Dev-only rewrite of /api to the local FastAPI. In production, Vercel services route /api. */
export function devApiRewrites(nodeEnv: string | undefined): Rewrite[] {
  if (nodeEnv === "production") return [];
  return [{ source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` }];
}
