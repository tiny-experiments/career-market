/**
 * The one door to the API: JSON over GET, a typed answer or a typed refusal.
 * The API is public and read-only, so a request carries no credentials and no
 * custom headers; that keeps it a simple cross-origin request with no preflight.
 */

/** The codes `apps/api/src/http/errors.ts` sends, plus the one the API cannot send. */
export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "NOT_READY"
  | "RATE_LIMITED"
  | "ORIGIN_NOT_ALLOWED"
  | "SOURCE_UNAVAILABLE"
  | "INTERNAL"
  /** The API was never reached. */
  | "NETWORK";

const SERVER_CODES: ReadonlySet<string> = new Set<ApiErrorCode>([
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "NOT_READY",
  "RATE_LIMITED",
  "ORIGIN_NOT_ALLOWED",
  "SOURCE_UNAVAILABLE",
  "INTERNAL",
]);

export interface ApiErrorDetails {
  /** Messages for named query or path fields, with `VALIDATION_FAILED`. */
  readonly fields?: Readonly<Record<string, string>>;
}

/** An answer the API refused to give, carrying the `code` it refused with. */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly details: ApiErrorDetails;

  public constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details: ApiErrorDetails = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

export const isAbort = (error: unknown): boolean =>
  (error as { readonly name?: unknown } | null)?.name === "AbortError";

const LOCAL_API = "http://127.0.0.1:4100";

/**
 * Where the API lives. In development the browser only talks to the dev
 * server, which proxies `/api`; a build goes straight to `VITE_API_URL`, or to
 * the local API when none is set.
 */
export function resolveApiBase(env: {
  readonly DEV: boolean;
  readonly VITE_API_URL?: string | undefined;
}): string {
  if (env.DEV) return "";
  const configured = env.VITE_API_URL?.trim();
  return (configured ? configured : LOCAL_API).replace(/\/+$/, "");
}

const API_BASE = resolveApiBase(import.meta.env);

export type QueryValue = string | number | boolean | undefined;
export type Query = Readonly<Record<string, QueryValue>>;

/** Sorted and without blanks, so one logical query is always one URL. */
export function buildPath(path: string, query?: Query): string {
  if (query === undefined) return path;
  const search = new URLSearchParams();
  for (const key of Object.keys(query).sort()) {
    const value = query[key];
    if (value !== undefined) search.set(key, String(value));
  }
  const suffix = search.toString();
  return suffix === "" ? path : `${path}?${suffix}`;
}

export interface RequestOptions {
  readonly query?: Query | undefined;
  readonly signal?: AbortSignal | undefined;
  /** Refusals whose body is a real answer, such as a closed job's 410. */
  readonly accept?: readonly number[] | undefined;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (cause) {
    if (isAbort(cause)) throw cause;
    return undefined;
  }
}

function toApiError(response: Response, body: unknown): ApiError {
  const shape =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const code =
    typeof shape["code"] === "string" && SERVER_CODES.has(shape["code"])
      ? (shape["code"] as ApiErrorCode)
      : "INTERNAL";
  const message =
    typeof shape["message"] === "string"
      ? shape["message"]
      : response.statusText;
  return new ApiError(
    response.status,
    code,
    message,
    typeof shape["fields"] === "object" && shape["fields"] !== null
      ? { fields: shape["fields"] as Record<string, string> }
      : {},
  );
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${buildPath(path, options.query)}`, {
      credentials: "omit",
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  } catch (cause) {
    if (isAbort(cause)) throw cause;
    throw new ApiError(0, "NETWORK", "The API could not be reached.");
  }

  const body = await readJson(response);
  const answered = response.ok || options.accept?.includes(response.status);
  if (!answered) throw toApiError(response, body);
  // A 200 that is not JSON is a proxy or hosting page, not an answer.
  if (body === undefined) {
    throw new ApiError(response.status, "INTERNAL", "The API sent no JSON.");
  }
  return body as T;
}
