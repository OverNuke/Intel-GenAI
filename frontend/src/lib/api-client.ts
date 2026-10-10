import type { paths } from "./api-types";

type GetPaths = {
  [P in keyof paths]: paths[P] extends { get: { responses: { 200: { content: { "application/json": unknown } } } } }
    ? P
    : never;
}[keyof paths];

type PostPaths = { [P in keyof paths]: paths[P] extends { post: unknown } ? P : never }[keyof paths];

export type GetResponse<P extends GetPaths> = paths[P] extends {
  get: { responses: { 200: { content: { "application/json": infer R } } } };
}
  ? R
  : never;

type PostOperation<P extends PostPaths> = paths[P] extends { post: infer O } ? O : never;

export type PostBody<P extends PostPaths> = PostOperation<P> extends {
  requestBody?: { content: { "application/json": infer B } };
}
  ? NonNullable<B>
  : never;

/** 200 JSON body; endpoints answering 204 (logout) resolve to `undefined`. */
export type PostResponse<P extends PostPaths> = PostOperation<P> extends {
  responses: { 200: { content: { "application/json": infer R } } };
}
  ? R
  : undefined;

/** Typed JSON bodies for the 400/401 answers of an operation (if it declares any). */
export type PostError<P extends PostPaths> = PostOperation<P> extends { responses: infer R }
  ? {
      [S in 400 | 401]: S extends keyof R ? (R[S] extends { content: { "application/json": infer B } } ? B : never) : never;
    }[400 | 401]
  : never;

export type ApiResult<T, E = never> = { ok: true; data: T } | { ok: false; status: number; error?: E };

export type RequestOptions = {
  /** Prefix for server-side calls that need an absolute URL. */
  baseUrl?: string;
  headers?: Record<string, string>;
  cache?: RequestCache;
};

function buildInit(base: RequestInit, headers: Record<string, string>, opts: RequestOptions): RequestInit {
  const init: RequestInit = { ...base, headers: { ...headers, ...opts.headers } };
  if (opts.cache) init.cache = opts.cache;
  return init;
}

/** Typed GET. Never throws: network/parse failures resolve to `{ok:false}` (status 0 = no response). */
export async function apiGet<P extends GetPaths>(
  path: P,
  fetchImpl: typeof fetch = fetch,
  opts: RequestOptions = {},
): Promise<ApiResult<GetResponse<P>>> {
  let response: Response;
  try {
    response = await fetchImpl(`${opts.baseUrl ?? ""}${path}`, buildInit({}, { Accept: "application/json" }, opts));
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

/** Typed POST (JSON). Never throws. On 400/401 the parsed body is returned as `error`. */
export async function apiPost<P extends PostPaths>(
  path: P,
  body: PostBody<P> | undefined,
  fetchImpl: typeof fetch = fetch,
  opts: RequestOptions = {},
): Promise<ApiResult<PostResponse<P>, PostError<P>>> {
  const base: RequestInit = { method: "POST" };
  if (body !== undefined) base.body = JSON.stringify(body);
  let response: Response;
  try {
    response = await fetchImpl(
      `${opts.baseUrl ?? ""}${path}`,
      buildInit(base, { Accept: "application/json", "Content-Type": "application/json" }, opts),
    );
  } catch {
    return { ok: false, status: 0 };
  }
  if (response.status === 400 || response.status === 401) {
    try {
      return { ok: false, status: response.status, error: (await response.json()) as PostError<P> };
    } catch {
      return { ok: false, status: response.status };
    }
  }
  if (!response.ok) return { ok: false, status: response.status };
  if (response.status === 204) return { ok: true, data: undefined as PostResponse<P> };
  try {
    return { ok: true, data: (await response.json()) as PostResponse<P> };
  } catch {
    return { ok: false, status: response.status };
  }
}
