"use client";

import { CalendarDays } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { fetchMemorialDates, type MemorialDate } from "@/lib/api/home";

const MAX_ITEMS = 3;

/** Ближайшие даты текущего месяца: сегодняшние, затем будущие и даты без дня. */
function upcoming(items: MemorialDate[], today: number): MemorialDate[] {
  return items.filter((item) => item.is_today || item.day === null || item.day >= today).slice(0, MAX_ITEMS);
}

/**
 * Календарь (T5.15): сегодняшняя дата и ближайшие памятные даты месяца из публичного API.
 * Погоды нет: внешний источник в info/ не подтверждён, блок это говорит.
 */
export function CalendarWidget() {
  const t = useTranslations("misc.calendar");
  const locale = useLocale();
  const [dates, setDates] = useState<MemorialDate[] | null>(null);
  const now = new Date();
  const today = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(now);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" });

  useEffect(() => {
    let active = true;
    fetchMemorialDates(locale).then((result) => {
      if (active) setDates(result ? upcoming(result.items, new Date().getDate()) : []);
    });
    return () => {
      active = false;
    };
  }, [locale]);

  return (
    <section aria-labelledby="calendar-widget" className="space-y-2 rounded-lg border bg-surface p-4">
      <h2 id="calendar-widget" className="flex items-center gap-2 font-semibold">
        <CalendarDays className="size-4 text-primary" aria-hidden />
        {t("widgetTitle")}
      </h2>
      <p className="font-medium">{today}</p>
      {dates !== null && dates.length > 0 && (
        <ul className="space-y-1 text-sm">
          {dates.map((item, index) => (
            <li key={index} lang={item.text_lang}>
              <span className="font-medium">
                {item.day ? `${item.day} ${monthName.format(new Date(2026, item.month - 1, 1))}` : (item.date_text ?? t("noDay"))}
                {item.event_year ? ` · ${item.event_year}` : ""}
              </span>
              {" — "}
              {item.text}
            </li>
          ))}
        </ul>
      )}
      {dates !== null && dates.length === 0 && <p className="text-sm text-muted-foreground">{t("widgetNone")}</p>}
      <p className="text-sm">
        <Link href="/calendar" className="text-primary hover:underline">{t("widgetAll")}</Link>
      </p>
      <p className="text-sm text-muted-foreground">{t("widgetWeather")}</p>
    </section>
  );
}
