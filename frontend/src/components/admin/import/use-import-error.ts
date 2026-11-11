"use client";

import { useTranslations } from "next-intl";
import { AdminApiError } from "@/lib/api/admin";
import { useApiError } from "../use-api-error";

/** Текст ошибки импорта/переводов: свои коды — из adminImport.errors, остальные — общие admin.errors. */
export function useImportError() {
  const t = useTranslations("adminImport.errors");
  const generic = useApiError();
  const code = (value: string) => (t.has(value) ? t(value) : value);
  const describe = (error: unknown) => {
    if (!(error instanceof AdminApiError) || !t.has(error.code)) return generic(error);
    // 503 ai_unavailable: добавляем причину, чтобы было понятно, что делать (запустить Ollama, подождать…).
    const reason = error.reason && t.has(`ai_reason.${error.reason}`) ? ` ${t(`ai_reason.${error.reason}`)}` : "";
    return t(error.code) + reason;
  };
  return { code, describe };
}
