"use client";

import { Bot, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { localeLabels } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

export const FIELD_LANGS = ["kk", "ru", "en"] as const;
export type FieldLang = (typeof FIELD_LANGS)[number];

interface LangTabsProps {
  lang: FieldLang;
  onChange: (lang: FieldLang) => void;
  /** Тексты поля по языкам: у заполненного языка — галочка. */
  value: Record<string, string | undefined>;
  /** Статус перевода по языкам: машинный перевод помечается значком. */
  status?: Record<string, string>;
}

/** Переключатель языка многоязычного поля (KZ / RU / EN) с пометками «заполнено» и «машинный перевод». */
export function LangTabs({ lang, onChange, value, status }: LangTabsProps) {
  const t = useTranslations("admin.langTabs");
  return (
    <div role="tablist" aria-label={t("label")} className="inline-flex rounded-full bg-surface-muted p-0.5">
      {FIELD_LANGS.map((code) => {
        const filled = Boolean(value[code]?.trim());
        const machine = status?.[code] === "machine";
        return (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={lang === code}
            title={machine ? t("machine") : undefined}
            onClick={() => onChange(code)}
            className={cn(
              "inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold",
              lang === code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary",
            )}
          >
            {localeLabels[code].short}
            {machine ? <Bot className="size-3.5" aria-hidden /> : filled ? <Check className="size-3.5" aria-hidden /> : null}
            <span className="sr-only">{machine ? t("machine") : filled ? t("filled") : t("empty")}</span>
          </button>
        );
      })}
    </div>
  );
}
