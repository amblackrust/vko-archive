"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { fetchMemorialDates, type MemorialDate } from "@/lib/api/home";
import { formatDayMonth, formatLongDate, monthName } from "@/lib/dates";
import { Link } from "@/lib/i18n/navigation";

const MAX_ITEMS = 2;

/**
 * Полоса в подвале: сегодняшняя дата и ближайшие памятные даты месяца из календаря архива.
 * Дата берётся в браузере после загрузки: у сервера может быть другой часовой пояс.
 * Погоды нет: источник данных заказчик не подтвердил.
 */
export function CalendarWidget() {
  const t = useTranslations("misc.calendar");
  const locale = useLocale();
  const [now, setNow] = useState<Date | null>(null);
  const [dates, setDates] = useState<MemorialDate[] | null>(null);

  useEffect(() => {
    const today = new Date();
    let active = true;
    setNow(today);
    fetchMemorialDates(locale).then((result) => {
      // Сегодняшние, затем будущие и даты без дня.
      if (active) setDates((result?.items ?? []).filter((item) => item.is_today || item.day === null || item.day >= today.getDate()).slice(0, MAX_ITEMS));
    });
    return () => {
      active = false;
    };
  }, [locale]);

  return (
    <section aria-labelledby="calendar-widget" className="grid gap-x-10 gap-y-3 border-t pt-6 text-sm md:grid-cols-[13rem_minmax(0,1fr)_auto]">
      <div>
        <h2 id="calendar-widget" className="text-sm font-semibold text-muted-foreground">{t("widgetTitle")}</h2>
        <p className="mt-1 min-h-6 text-base font-semibold">{now && formatLongDate(now.getDate(), now.getMonth() + 1, now.getFullYear(), locale)}</p>
      </div>
      <ul className="space-y-1.5">
        {dates?.map((item, index) => (
          <li key={index} lang={item.text_lang}>
            <span className="font-semibold">
              {item.day ? formatDayMonth(item.day, item.month, locale) : monthName(item.month, locale)}
              {item.event_year ? `, ${item.event_year}` : ""}.
            </span>{" "}
            {item.text}
          </li>
        ))}
        {dates?.length === 0 && <li className="text-muted-foreground">{t("widgetNone")}</li>}
      </ul>
      <Link href="/calendar" className="self-start font-medium underline underline-offset-[3px] hover:decoration-2">{t("widgetAll")}</Link>
    </section>
  );
}
