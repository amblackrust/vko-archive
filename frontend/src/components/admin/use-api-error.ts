"use client";

import { useTranslations } from "next-intl";
import { AdminApiError } from "@/lib/api/admin";

/** Превращает ошибку админ-API в понятный текст (коды — в admin.errors, иначе общий текст). */
export function useApiError() {
  const t = useTranslations("admin.errors");
  return (error: unknown): string => {
    if (!(error instanceof AdminApiError)) return t("generic");
    if (error.status === 429 && error.retryAfter) return t("rateLimitedAfter", { seconds: error.retryAfter });
    return t.has(error.code) ? t(error.code) : error.status === 403 ? t("forbidden") : t("generic");
  };
}
