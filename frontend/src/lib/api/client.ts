import type { components } from "./schema";

export type Schema = components["schemas"];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(typeof detail === "string" ? detail : `HTTP ${status}`);
  }
}

type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

type Options = {
  query?: Query;
  body?: unknown;
  /** Which session CSRF cookie to echo for unsafe methods. */
  scope?: "admin" | "visitor";
  signal?: AbortSignal;
  background?: boolean;
  revalidate?: number;
};

const CSRF_COOKIES = { admin: "vko_csrf", visitor: "vko_visitor_csrf" } as const;

function baseUrl(): string {
  // On the server there is no origin to proxy through: talk to the backend directly.
  return typeof window === "undefined" ? (process.env.BACKEND_URL ?? "http://localhost:8000") : "";
}

export function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${baseUrl() || "http://x"}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, String(v)));
    else url.searchParams.set(key, String(value));
  }
  return baseUrl() ? url.toString() : `${url.pathname}${url.search}`;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function csrfHeaders(scope: "admin" | "visitor"): Record<string, string> {
  const token = readCookie(CSRF_COOKIES[scope]);
  return token ? { "X-CSRF-Token": decodeURIComponent(token) } : {};
}

async function request<T>(method: string, path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") Object.assign(headers, csrfHeaders(opts.scope ?? "admin"));
  if (opts.background) headers["X-Background"] = "1";

  const res = await fetch(buildUrl(path, opts.query), {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    credentials: "include",
    signal: opts.signal,
    ...(typeof window === "undefined" && method === "GET"
      ? { next: { revalidate: opts.revalidate ?? 30 } }
      : { cache: "no-store" as const }),
  });

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? data);
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: Options) => request<T>("GET", path, opts),
  post: <T>(path: string, opts?: Options) => request<T>("POST", path, opts),
  put: <T>(path: string, opts?: Options) => request<T>("PUT", path, opts),
  patch: <T>(path: string, opts?: Options) => request<T>("PATCH", path, opts),
  delete: <T>(path: string, opts?: Options) => request<T>("DELETE", path, opts),
};
