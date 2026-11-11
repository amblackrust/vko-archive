"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const FIELD_LANGS = ["kk", "ru", "en"] as const;

interface I18nFieldProps {
  label: string;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  multiline?: boolean;
  required?: boolean;
  /** Статус перевода по языкам (verified / machine / missing) для пометки вкладок. */
  translationStatus?: Record<string, string>;
}

/** Поле с вкладками kk / ru / en (PLAN T6.11). Пустой язык отправляется как отсутствующий. */
export function I18nField({ label, value, onChange, multiline, required, translationStatus }: I18nFieldProps) {
  const t = useTranslations("adminCatalog.i18n");
  const id = useId();
  const [lang, setLang] = useState<(typeof FIELD_LANGS)[number]>("ru");
  const setText = (text: string) => onChange({ ...value, [lang]: text });
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`${id}-${lang}`} className="text-sm font-medium">
          {label}
          {required && <span aria-hidden> *</span>}
        </label>
        <div role="tablist" aria-label={t("languages")} className="flex gap-1">
          {FIELD_LANGS.map((code) => (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={lang === code}
              onClick={() => setLang(code)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs uppercase",
                lang === code ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground",
              )}
            >
              {code}
              {value[code] ? <span aria-label={t("filled")}> •</span> : null}
              {translationStatus?.[code] === "machine" && <span title={t("machine")}> ⚙</span>}
            </button>
          ))}
        </div>
      </div>
      {multiline ? (
        <textarea
          id={`${id}-${lang}`}
          lang={lang}
          rows={5}
          className="w-full rounded-md border bg-surface px-3 py-2 text-sm"
          value={value[lang] ?? ""}
          onChange={(e) => setText(e.target.value)}
        />
      ) : (
        <Input id={`${id}-${lang}`} lang={lang} value={value[lang] ?? ""} onChange={(e) => setText(e.target.value)} />
      )}
    </div>
  );
}
