"use client";

import { useTranslations } from "next-intl";
import { AdminApiError } from "@/lib/api/admin";
import { useApiError } from "../use-api-error";

/** Текст ошибки импорта/переводов: свои коды — из adminImport.errors, остальные — общие admin.errors. */
export function useImportError() {
  const t = useTranslations("adminImport.errors");
  const generic = useApiError();
  const code = (value: string) => (t.has(value) ? t(value) : value);
  const describe = (error: unknown) =>
    error instanceof AdminApiError && t.has(error.code) ? t(error.code) : generic(error);
  return { code, describe };
}
