"use client";

import { useTranslations } from "next-intl";
import { AdminApiError } from "@/lib/api/admin";
import { useApiError } from "../use-api-error";

/** Ошибки ИИ-инструментов: свои коды в adminAi.errors, остальные — общие admin.errors. */
export function useAiError() {
  const t = useTranslations("adminAi.errors");
  const common = useApiError();
  return (error: unknown): string => (error instanceof AdminApiError && t.has(error.code) ? t(error.code) : common(error));
}
