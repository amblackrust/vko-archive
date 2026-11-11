import { useTranslations } from "next-intl";
import { DemoBadge } from "@/components/ui/demo-badge";

/** Пометка, если текст показан не на языке страницы (перевода нет) или перевод машинный. */
export function TranslationNote({ requested, actual, status }: { requested: string; actual: string; status?: string }) {
  const t = useTranslations("help.translation");
  if (actual !== requested) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <DemoBadge kind="noTranslation" />
        {t("fallback", { lang: t.has(`langName.${actual}`) ? t(`langName.${actual}`) : actual })}
      </p>
    );
  }
  return status === "machine" ? <p className="text-sm text-muted-foreground">{t("machine")}</p> : null;
}
