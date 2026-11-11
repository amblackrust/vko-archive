import { API_URL } from "@/lib/api/client";
import { AdminApiError, adminRequest } from "@/lib/api/admin";

/** Контракты /api/admin/audit (backend/app/schemas/audit.py). Детали записи содержат только очищенные поля. */
export interface AuditRecord {
  id: number;
  ts: string;
  user_id: string | null;
  actor: string | null;
  action_type: string;
  object_type: string | null;
  object_id: string | null;
  result: string;
  details: Record<string, unknown>;
  ip: string | null;
}

export interface AuditFilters {
  action_type?: string;
  object_type?: string;
  result?: string;
  date_from?: string;
  date_to?: string;
  q?: string;
}

function query(filters: AuditFilters, extra: Record<string, string | number> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) if (value !== undefined && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const auditApi = {
  list: (filters: AuditFilters, page: number, pageSize: number) =>
    adminRequest<{ items: AuditRecord[]; total: number; page: number; page_size: number }>(
      `/audit${query(filters, { page, page_size: pageSize })}`,
    ),
  /** CSV с теми же фильтрами; скачивание под сессионной cookie. */
  exportCsv: async (filters: AuditFilters): Promise<Blob> => {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/admin/audit/export${query(filters)}`, { credentials: "include", cache: "no-store" });
    } catch {
      throw new AdminApiError(0, "network");
    }
    if (!response.ok) throw new AdminApiError(response.status, response.status === 403 ? "forbidden" : "error");
    return response.blob();
  },
};
