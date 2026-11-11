"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { TranslationStatus } from "./translations-api";

const styles: Record<TranslationStatus, string> = {
  verified: "bg-accent-soft text-accent-soft-foreground",
  machine: "border border-dashed border-primary text-primary",
  missing: "bg-surface-muted text-muted-foreground",
};

interface TranslationStatusBadgeProps {
  lang: string;
  status: TranslationStatus | undefined;
  className?: string;
}

/**
 * Бейдж статуса перевода одного языка: «KK · Проверен / Машинный / Нет перевода».
 * Переиспользуемый: таблица переводов, вкладки I18nField, формы объектов.
 */
export function TranslationStatusBadge({ lang, status = "missing", className }: TranslationStatusBadgeProps) {
  const t = useTranslations("adminImport.translations");
  const text = t(`statuses.${status}`);
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs", styles[status], className)}
      title={t("statusLabel", { lang: lang.toUpperCase(), status: text })}
    >
      <span className="font-semibold uppercase">{lang}</span>
      <span>{text}</span>
    </span>
  );
}
