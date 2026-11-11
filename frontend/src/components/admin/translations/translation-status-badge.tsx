"use client";

import { Bot, CircleCheck, CircleDashed, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { localeLabels, type Locale } from "@/lib/i18n/routing";
import { Badge, type Tone } from "../kit/badge";
import { TRANSLATION_LANGS, type TranslationStatus } from "./translations-api";

const styles: Record<TranslationStatus, { tone: Tone; icon: LucideIcon }> = {
  verified: { tone: "success", icon: CircleCheck },
  machine: { tone: "warning", icon: Bot },
  missing: { tone: "neutral", icon: CircleDashed },
};

/** Статус перевода одного языка: «KZ · Проверен / Машинный / Нет перевода». */
export function TranslationStatusBadge({ lang, status = "missing" }: { lang: string; status: TranslationStatus | undefined }) {
  const t = useTranslations("adminImport.translations.statuses");
  const style = styles[status] ?? styles.missing;
  return (
    <Badge tone={style.tone}>
      <span className="font-bold">{localeLabels[lang as Locale]?.short ?? lang}</span>
      {t(status in styles ? status : "missing")}
    </Badge>
  );
}

/** Статусы перевода по всем трём языкам в строку. */
export function TranslationBadges({ status, label = true }: { status: Record<string, string>; label?: boolean }) {
  const t = useTranslations("adminImport.translations");
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm">
      {label && <span className="mr-1 text-muted-foreground">{t("badgesLabel")}</span>}
      {TRANSLATION_LANGS.map((lang) => <TranslationStatusBadge key={lang} lang={lang} status={status[lang] as TranslationStatus | undefined} />)}
    </p>
  );
}
