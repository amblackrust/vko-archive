import { useTranslations } from "next-intl";

/**
 * Календарь/погода (T5.15). Календарь — текущая дата браузера/сервера; погоды нет: внешнего источника
 * в info/ не подтверждено, поэтому блок показывает статус подключения.
 */
export function CalendarWidget({ locale }: { locale: string }) {
  const t = useTranslations("misc.calendar");
  const today = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return (
    <section aria-labelledby="calendar-widget" className="rounded-lg border bg-surface p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="calendar-widget" className="font-semibold">{t("widgetTitle")}</h2>
      </div>
      <p className="font-medium">{today}</p>
      <p className="text-sm text-muted-foreground">{t("widgetWeather")}</p>
    </section>
  );
}
