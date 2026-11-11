import { useTranslations } from "next-intl";

/** Пометка вымышленной записи: демонстрационные данные обозначаются прямо, чтобы их не приняли за архивные. */
export function DemoTag() {
  const t = useTranslations("common.demo");
  return (
    <span title={t("recordHint")} className="inline-flex items-center rounded-sm bg-surface-muted px-1.5 py-0.5 font-sans text-xs font-medium tracking-normal text-muted-foreground">
      {t("record")}
    </span>
  );
}
