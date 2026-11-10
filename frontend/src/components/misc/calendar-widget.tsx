import { useTranslations } from "next-intl";
import { DemoBadge } from "@/components/ui/demo-badge";

/**
 * Календарь/погода (T5.15). Календарь — текущая дата браузера/сервера; погоды нет: внешнего источника
 * в info/ не подтверждено, поэтому блок помечен как демо и показывает статус подключения.
 */
export function CalendarWidget({ locale }: { locale: string }) {
  const t = useTranslations("misc.calendar");
  const today = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return (
    <section aria-labelledby="calendar-widget" className="rounded-lg border bg-surface p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="calendar-widget" className="font-semibold">{t("widgetTitle")}</h2>
        <DemoBadge />
      </div>
      <p className="font-medium">{today}</p>
      <p className="text-sm text-muted-foreground">{t("widgetWeather")}</p>
      <p className="text-xs text-muted-foreground">{t("demoNote")}</p>
    </section>
  );
}
