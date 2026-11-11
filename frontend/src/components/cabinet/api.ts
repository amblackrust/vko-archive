import { API_URL } from "@/lib/api/client";

/** Контракты backend/app/schemas/cabinet.py. Кабинет посетителя не связан с сотрудниками (cookie vko_visitor). */

export type FavoriteType = "document" | "exhibition" | "news";
export type Topic = "news" | "exhibitions";

export interface VisitorMe {
  id: string;
  email: string;
  display_name: string;
  email_confirmed: boolean;
  csrf_token: string;
}

export interface FavoriteItem {
  type: FavoriteType;
  id: string;
  title: string;
  href: string;
  is_demo: boolean;
}

export interface SelectionDocument {
  id: string;
  title: string;
  href: string;
  archive_code: string | null;
}

export interface Selection {
  id: string;
  title: string;
  documents: SelectionDocument[];
}

export interface SearchEntry {
  id: string;
  query: string;
  href: string;
}

export interface Subscriptions {
  topics: Topic[];
}

/** Ошибка API: `code` — стабильный detail (ключ cabinet.errors.*), `status` — HTTP-код. */
export class CabinetError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

const CSRF_COOKIE = "vko_visitor_csrf";

function csrfToken(): string {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : "";
}

/** Запрос с cookie сессии и CSRF-заголовком на изменяющих методах. 204 → undefined. */
export async function cabinetFetch<T = void>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-Token"] = csrfToken();
  const response = await fetch(`${API_URL}/api/cabinet${path}`, {
    method,
    headers,
    credentials: "include",
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    let code = "generic";
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") code = body.detail;
    } catch {
      // тело не JSON — остаётся generic
    }
    throw new CabinetError(response.status, code);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/** Текущий посетитель или null, если не вошёл. Другие ошибки (сеть, 5xx) пробрасываются. */
export async function fetchMe(): Promise<VisitorMe | null> {
  try {
    return await cabinetFetch<VisitorMe>("/me");
  } catch (error) {
    if (error instanceof CabinetError && error.status === 401) return null;
    throw error;
  }
}
