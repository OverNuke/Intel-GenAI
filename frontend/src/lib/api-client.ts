import type { paths } from "./api-types";

type GetPaths = {
  [P in keyof paths]: paths[P] extends { get: { responses: { 200: { content: { "application/json": unknown } } } } }
    ? P
    : never;
}[keyof paths];

export type GetResponse<P extends GetPaths> = paths[P] extends {
  get: { responses: { 200: { content: { "application/json": infer R } } } };
}
  ? R
  : never;

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number };

/** Typed GET. Never throws: network/parse failures resolve to `{ok:false}` (status 0 = no response). */
export async function apiGet<P extends GetPaths>(
  path: P,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<GetResponse<P>>> {
  let response: Response;
  try {
    response = await fetchImpl(path, { headers: { Accept: "application/json" } });
  } catch {
    return { ok: false, status: 0 };
  }
  if (!response.ok) return { ok: false, status: response.status };
  try {
    return { ok: true, data: (await response.json()) as GetResponse<P> };
  } catch {
    return { ok: false, status: response.status };
  }
}
