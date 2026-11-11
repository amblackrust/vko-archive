import { API_URL } from "@/lib/api/client";
import { AdminApiError, adminRequest, type BranchOption } from "@/lib/api/admin";

/** Контракты /api/admin/import и /api/admin/export (backend/app/schemas/import_export.py). */
export type RowAction = "create" | "update" | "unchanged" | "skip" | "error";

export interface ImportRow {
  line: number;
  archive_code: string;
  action: RowAction;
  errors: { field: string | null; code: string }[];
  values: Record<string, string>;
  object_id: string | null;
}

export interface ImportReport {
  headers: string[];
  /** Индекс колонки (строкой) → поле. */
  mapping: Record<string, string>;
  suggested_mapping: Record<string, string>;
  fields: string[];
  applied: boolean;
  counts: Record<RowAction, number>;
  rows: ImportRow[];
}

export interface ImportOptions {
  mapping?: Record<string, string>;
  branchId?: string;
  atomic?: boolean;
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : "";
}

/**
 * Файл уходит «сырым» телом запроса (сервер сам определяет CSV/XLSX), параметры — в query.
 * CSRF-токен берём из сессии (`me.csrf_token`), как и adminRequest.
 */
async function upload(action: "preview" | "apply", file: File, csrf: string, options: ImportOptions): Promise<ImportReport> {
  const path = `/import/${action}${query({
    mapping: options.mapping ? JSON.stringify(options.mapping) : undefined,
    branch_id: options.branchId,
    atomic: options.atomic ? "true" : undefined,
  })}`;
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/admin${path}`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrf, "Content-Type": "application/octet-stream" },
      credentials: "include",
      cache: "no-store",
      body: file,
    });
  } catch {
    throw new AdminApiError(0, "network");
  }
  if (!response.ok) throw new AdminApiError(response.status, await errorCode(response));
  return (await response.json()) as ImportReport;
}

async function errorCode(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown };
    return typeof data.detail === "string" ? data.detail : "error";
  } catch {
    return "error";
  }
}

export interface ExportFilters {
  format: "csv" | "xlsx";
  branchId?: string;
  workflowStatus?: string;
}

export const importApi = {
  branches: () => adminRequest<BranchOption[]>("/import/branches"),
  preview: (file: File, csrf: string, options: ImportOptions) => upload("preview", file, csrf, options),
  apply: (file: File, csrf: string, options: ImportOptions) => upload("apply", file, csrf, options),
  /** Скачивает выгрузку как файл (GET, сессия в cookie). */
  exportDocuments: async ({ format, branchId, workflowStatus }: ExportFilters): Promise<Blob> => {
    let response: Response;
    try {
      response = await fetch(
        `${API_URL}/api/admin/export/documents${query({ format, branch_id: branchId, workflow_status: workflowStatus })}`,
        { credentials: "include", cache: "no-store" },
      );
    } catch {
      throw new AdminApiError(0, "network");
    }
    if (!response.ok) throw new AdminApiError(response.status, await errorCode(response));
    return response.blob();
  },
};

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Ячейка CSV, которую табличный редактор не выполнит как формулу. */
function safeCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Протокол импорта (строки с ошибками и пропуски) в CSV с BOM — открывается в Excel. */
export function reportCsv(report: ImportReport, header: string[], describe: (code: string) => string): Blob {
  const lines = [header.map(safeCell).join(",")];
  for (const row of report.rows) {
    if (row.action !== "error" && row.action !== "skip") continue;
    for (const error of row.errors) {
      lines.push([row.line, row.archive_code, row.action, error.field ?? "", error.code, describe(error.code)].map(safeCell).join(","));
    }
  }
  return new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
}
