"use client";

import { useTranslations } from "next-intl";
import { AdminApiError } from "@/lib/api/admin";

/** Раздел, чьи коды ошибок смотрим первыми: каталог и контент, ИИ-инструменты, импорт и переводы. */
export type ErrorScope = "catalog" | "ai" | "import";
const NAMESPACE: Record<ErrorScope, "adminCatalog.errors" | "adminAi.errors" | "adminImport.errors"> = {
  catalog: "adminCatalog.errors",
  ai: "adminAi.errors",
  import: "adminImport.errors",
};

/**
 * Превращает ошибку админ-API в понятный текст. Код ищется в словаре раздела, затем в общем admin.errors.
 * 403 всегда объясняет, что у роли нет права; 503 ai_unavailable дополняется причиной.
 */
export function useApiError(scope?: ErrorScope) {
  const common = useTranslations("admin.errors");
  const scoped = useTranslations(NAMESPACE[scope ?? "catalog"]);
  const reasons = useTranslations("admin.aiReason");
  /** Текст по коду (строки протокола импорта); неизвестный код возвращается как есть. */
  const code = (value: string): string => (scope && scoped.has(value) ? scoped(value) : common.has(value) ? common(value) : value);
  const describe = (error: unknown): string => {
    if (!(error instanceof AdminApiError)) return common("generic");
    if (error.status === 429 && error.retryAfter) return common("rateLimitedAfter", { seconds: error.retryAfter });
    if (error.code === "ai_unavailable") {
      const reason = error.reason && reasons.has(error.reason) ? ` ${reasons(error.reason)}` : "";
      return common("ai_unavailable") + reason;
    }
    if (scope && scoped.has(error.code)) return scoped(error.code);
    if (common.has(error.code)) return common(error.code);
    return common(error.status === 403 ? "forbidden" : "generic");
  };
  return Object.assign(describe, { code });
}
