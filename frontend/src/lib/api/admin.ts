import { API_URL } from "./client";

/**
 * Клиент админ-API (/api/admin). Сессия — httpOnly-cookie (credentials: "include"),
 * изменяющие запросы несут X-CSRF-Token (токен приходит в login/me и хранится только в памяти).
 * Фоновые опросы (колокольчик) — background: true: они не продлевают таймаут сессии.
 */

export interface Me {
  id: string;
  email: string;
  full_name: string;
  branch_id: string | null;
  roles: string[];
  permissions: string[];
  is_super: boolean;
  branch_scoped: boolean;
  csrf_token: string;
}

/** Бэкенд закрывает сессию после 30 минут без не-фоновых запросов (DECISIONS п.17). */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    /** Машинный код из `detail` (invalid_credentials, forbidden, email_taken...); "network" — сервер недоступен. */
    readonly code: string,
    readonly retryAfter: number | null = null,
    /** Причина 503 ai_unavailable (ollama_unavailable | model_missing | bad_response | busy). */
    readonly reason: string | null = null,
  ) {
    super(code);
  }
}

let csrfToken: string | null = null;
let lastActivity = Date.now();
let onUnauthorized: (() => void) | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}
/** Момент последнего запроса, продлившего сессию. */
export function getLastActivity() {
  return lastActivity;
}
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Файл как «сырое» тело запроса (загрузки); тогда `body` не используется. */
  rawBody?: Blob;
  background?: boolean;
}

export async function adminRequest<T>(path: string, { method = "GET", body, rawBody, background = false }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined && !rawBody) headers["Content-Type"] = "application/json";
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  if (background) headers["X-Background"] = "1";
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/admin${path}`, {
      method,
      headers,
      credentials: "include",
      cache: "no-store",
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch {
    throw new AdminApiError(0, "network");
  }
  if (!response.ok) {
    let code = "error";
    let reason: string | null = null;
    try {
      const data = (await response.json()) as { detail?: unknown; reason?: unknown };
      if (typeof data.detail === "string") code = data.detail;
      if (typeof data.reason === "string") reason = data.reason;
      else if (response.status === 422) code = "invalid_input";
    } catch {
      /* тело не JSON — оставляем общий код */
    }
    const retry = Number(response.headers.get("Retry-After"));
    // 401 вне входа = сессия закончилась; сам вход (invalid_credentials) обрабатывает форма.
    if (response.status === 401 && path !== "/auth/login") onUnauthorized?.();
    throw new AdminApiError(response.status, code, Number.isFinite(retry) && retry > 0 ? retry : null, reason);
  }
  if (!background) lastActivity = Date.now();
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const adminApi = {
  login: async (email: string, password: string) => {
    const me = await adminRequest<Me>("/auth/login", { method: "POST", body: { email, password } });
    csrfToken = me.csrf_token;
    return me;
  },
  me: async () => {
    const me = await adminRequest<Me>("/auth/me");
    csrfToken = me.csrf_token;
    return me;
  },
  logout: () => adminRequest<void>("/auth/logout", { method: "POST" }),
};

/** Право для косметики интерфейса (меню, кнопки). Настоящая проверка — на сервере. */
export function can(me: Me, permission: string): boolean {
  return me.is_super || me.permissions.includes(permission);
}

export interface Notification {
  id: number;
  created_at: string;
  kind: string;
  message: Record<string, string>;
  object_type: string | null;
  object_id: string | null;
  is_read: boolean;
}

export const notificationsApi = {
  list: (background: boolean) =>
    adminRequest<{ items: Notification[]; unread: number }>("/notifications?limit=20", { background }),
  read: (id: number) => adminRequest<void>(`/notifications/${id}/read`, { method: "POST" }),
  readAll: () => adminRequest<void>("/notifications/read-all", { method: "POST" }),
};

export interface AuditEntry {
  id: number;
  ts: string;
  actor: string | null;
  action_type: string;
  object_type: string | null;
  object_id: string | null;
  result: string;
}

export interface Dashboard {
  counters: {
    funds: number;
    inventories: number | null;
    cases: number | null;
    documents: number;
    documents_published: number;
    users: number | null;
  } | null;
  review_total: number | null;
  review_tasks: { object_type: string; object_id: string; title: string; updated_at: string }[] | null;
  recent_actions: AuditEntry[] | null;
}

export type ComponentState = "ok" | "degraded" | "unavailable";
export interface Health {
  status: "ok" | "degraded";
  db: { status: ComponentState };
  ollama: { status: ComponentState };
  embeddings: { status: ComponentState };
}

export const dashboardApi = {
  get: () => adminRequest<Dashboard>("/dashboard"),
  /** Публичный эндпоинт: при недоступной БД отдаёт 503 с тем же телом. */
  health: async (): Promise<Health> => {
    const response = await fetch(`${API_URL}/api/health`, { cache: "no-store" });
    return (await response.json()) as Health;
  },
};

export const ROLE_CODES = [
  "super_admin",
  "site_admin",
  "editor",
  "archivist",
  "branch_admin",
  "moderator",
  "analyst",
] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  branch_id: string | null;
  roles: string[];
  is_active: boolean;
  is_locked: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface UserPage {
  items: AdminUser[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserListParams {
  q?: string;
  role?: string;
  is_active?: boolean;
  page: number;
  page_size: number;
}

export const usersApi = {
  list: (params: UserListParams) => {
    const query = new URLSearchParams({ page: String(params.page), page_size: String(params.page_size) });
    if (params.q) query.set("q", params.q);
    if (params.role) query.set("role", params.role);
    if (params.is_active !== undefined) query.set("is_active", String(params.is_active));
    return adminRequest<UserPage>(`/users?${query}`);
  },
  create: (body: { email: string; full_name: string; password: string; roles: string[]; branch_id: string | null }) =>
    adminRequest<AdminUser>("/users", { method: "POST", body }),
  update: (id: string, body: { email?: string; full_name?: string; branch_id?: string | null; is_active?: boolean }) =>
    adminRequest<AdminUser>(`/users/${id}`, { method: "PATCH", body }),
  setRoles: (id: string, roles: string[]) =>
    adminRequest<AdminUser>(`/users/${id}/roles`, { method: "PUT", body: { roles } }),
  resetPassword: (id: string, new_password: string) =>
    adminRequest<void>(`/users/${id}/password`, { method: "POST", body: { new_password } }),
};

export interface BranchOption {
  id: string;
  name: Record<string, string>;
}
export const branchOptionsApi = {
  list: () => adminRequest<BranchOption[]>("/users/branch-options"),
};
export function pickName(name: Record<string, string>, locale: string): string {
  return name[locale] ?? name.ru ?? name.kk ?? name.en ?? "";
}
