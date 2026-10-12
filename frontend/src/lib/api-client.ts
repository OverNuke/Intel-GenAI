import type { components, paths } from "./api-types";

export type GetPaths = {
  [P in keyof paths]: paths[P] extends { get: { responses: { 200: { content: { "application/json": unknown } } } } }
    ? P
    : never;
}[keyof paths];

export type PostPaths = { [P in keyof paths]: paths[P] extends { post: unknown } ? P : never }[keyof paths];

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

/** Statuses whose JSON body is surfaced as `error` (auth + the confirmed-write refusals). */
const ERROR_BODY_STATUSES = new Set([400, 401, 403, 404, 409, 422]);
type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422;

type ErrorBodyOf<Op> = Op extends { responses: infer R }
  ? Exclude<
      {
        [S in ErrorStatus]: S extends keyof R ? (R[S] extends { content: { "application/json": infer B } } ? B : never) : never;
      }[ErrorStatus],
      components["schemas"]["HTTPValidationError"]
    >
  : never;

/** Typed JSON bodies for the 4xx answers of an operation (if it declares any). */
export type PostError<P extends PostPaths> = ErrorBodyOf<PostOperation<P>>;

export type PatchPaths = { [P in keyof paths]: paths[P] extends { patch: { requestBody: unknown } } ? P : never }[keyof paths];
type PatchOperation<P extends PatchPaths> = paths[P] extends { patch: infer O } ? O : never;
export type PatchBody<P extends PatchPaths> = PatchOperation<P> extends {
  requestBody?: { content: { "application/json": infer B } };
}
  ? NonNullable<B>
  : never;
export type PatchResponse<P extends PatchPaths> = PatchOperation<P> extends {
  responses: { 200: { content: { "application/json": infer R } } };
}
  ? R
  : undefined;
export type PatchError<P extends PatchPaths> = ErrorBodyOf<PatchOperation<P>>;

export type ApiResult<T, E = never> = { ok: true; data: T } | { ok: false; status: number; error?: E };

export type RequestOptions = {
  /** Prefix for server-side calls that need an absolute URL. */
  baseUrl?: string;
  headers?: Record<string, string>;
  cache?: RequestCache;
  /** Values for `{name}` placeholders of the path template (URL-encoded). */
  params?: Record<string, string>;
  /** Query-string entries appended to the URL. */
  query?: Record<string, string>;
  /** Lets the caller abort (timeouts). */
  signal?: AbortSignal;
};

function buildUrl(path: string, opts: RequestOptions): string {
  const filled = path.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = opts.params?.[name];
    return value === undefined ? match : encodeURIComponent(value);
  });
  const query = opts.query ? new URLSearchParams(opts.query).toString() : "";
  return `${opts.baseUrl ?? ""}${filled}${query ? `?${query}` : ""}`;
}

function buildInit(base: RequestInit, headers: Record<string, string>, opts: RequestOptions): RequestInit {
  const init: RequestInit = { ...base, headers: { ...headers, ...opts.headers } };
  if (opts.cache) init.cache = opts.cache;
  if (opts.signal) init.signal = opts.signal;
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
    response = await fetchImpl(buildUrl(path, opts), buildInit({}, { Accept: "application/json" }, opts));
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

async function send<T, E>(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
  fetchImpl: typeof fetch,
  opts: RequestOptions,
): Promise<ApiResult<T, E>> {
  const base: RequestInit = { method };
  if (body !== undefined) base.body = JSON.stringify(body);
  let response: Response;
  try {
    response = await fetchImpl(
      buildUrl(path, opts),
      buildInit(base, { Accept: "application/json", "Content-Type": "application/json" }, opts),
    );
  } catch {
    return { ok: false, status: 0 };
  }
  if (ERROR_BODY_STATUSES.has(response.status)) {
    try {
      return { ok: false, status: response.status, error: (await response.json()) as E };
    } catch {
      return { ok: false, status: response.status };
    }
  }
  if (!response.ok) return { ok: false, status: response.status };
  if (response.status === 204) return { ok: true, data: undefined as T };
  try {
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, status: response.status };
  }
}

/** Typed POST (JSON). Never throws. On 400/401/403/404/409/422 the parsed body is returned as `error`. */
export function apiPost<P extends PostPaths>(
  path: P,
  body: PostBody<P> | undefined,
  fetchImpl: typeof fetch = fetch,
  opts: RequestOptions = {},
): Promise<ApiResult<PostResponse<P>, PostError<P>>> {
  return send("POST", path, body, fetchImpl, opts);
}

/** Typed PATCH (JSON). Same contract as `apiPost`. */
export function apiPatch<P extends PatchPaths>(
  path: P,
  body: PatchBody<P>,
  fetchImpl: typeof fetch = fetch,
  opts: RequestOptions = {},
): Promise<ApiResult<PatchResponse<P>, PatchError<P>>> {
  return send("PATCH", path, body, fetchImpl, opts);
}
