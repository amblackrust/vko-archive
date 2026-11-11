"use client";

import { useTranslations } from "next-intl";
import { AdminApiError } from "@/lib/api/admin";
import { useApiError } from "../use-api-error";

/** Ошибки разделов B14: свои коды в adminCatalog.errors, остальные — общие admin.errors. */
export function useCatalogError() {
  const t = useTranslations("adminCatalog.errors");
  const common = useApiError();
  return (error: unknown): string => (error instanceof AdminApiError && t.has(error.code) ? t(error.code) : common(error));
}
