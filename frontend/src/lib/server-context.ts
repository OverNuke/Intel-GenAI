import { headers } from "next/headers";
import { resolveApiOrigin, type ServerContext } from "./server-api";

/** Backend origin and incoming cookie for the current request (server components only). */
export async function readServerContext(): Promise<ServerContext> {
  const incoming = await headers();
  return { origin: resolveApiOrigin(process.env, incoming), cookie: incoming.get("cookie") };
}
