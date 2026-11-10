import { useTranslations } from "next-intl";

/** Пометка, если текст показан не на языке страницы (нет перевода) или перевод машинный. */
export function TranslationNote({ requested, actual, status }: { requested: string; actual: string; status: string }) {
  const t = useTranslations("help.translation");
  if (actual !== requested) {
    return <p className="text-sm text-accent">{t("fallback", { lang: t(`langName.${actual}`) })}</p>;
  }
  if (status === "machine") return <p className="text-sm text-accent">{t("machine")}</p>;
  return null;
}
