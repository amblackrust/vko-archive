import { useTranslations } from "next-intl";

/** Пометка, если текст показан не на языке страницы (перевода нет) или перевод машинный. */
export function TranslationNote({ requested, actual, status }: { requested: string; actual: string; status?: string }) {
  const t = useTranslations("help.translation");
  if (actual !== requested) {
    return (
      <p className="text-sm text-muted-foreground">{t("fallback", { lang: t.has(`langName.${actual}`) ? t(`langName.${actual}`) : actual })}</p>
    );
  }
  return status === "machine" ? <p className="text-sm text-muted-foreground">{t("machine")}</p> : null;
}
