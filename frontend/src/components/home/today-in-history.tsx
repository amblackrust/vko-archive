import { useTranslations } from "next-intl";
import type { MemorialDates } from "@/lib/api/home";
import { formatDayMonth, monthName } from "@/lib/dates";
import { Link } from "@/lib/i18n/navigation";

const MAX_ITEMS = 3;

/** Карточка «Этот день в истории»: сегодняшние памятные даты из календаря архива, а если их нет — ближайшие в месяце. */
export function TodayInHistory({ dates, locale }: { dates: MemorialDates; locale: string }) {
  const t = useTranslations("home.today");
  const now = new Date();
  const todays = dates.items.filter((item) => item.is_today);
  const upcoming = dates.items.filter((item) => item.day === null || item.day >= now.getDate());
  const items = (todays.length > 0 ? todays : upcoming.length > 0 ? upcoming : dates.items).slice(0, MAX_ITEMS);
  if (items.length === 0) return null;
  const month = monthName(now.getMonth() + 1, locale);
  return (
    <section aria-labelledby="home-today" className="container-page">
      <div className="card grid overflow-hidden lg:grid-cols-[18rem_1fr]">
        <div className="bg-primary-soft p-6 sm:p-8">
          <p className="text-4xl font-bold tabular-nums text-primary">{formatDayMonth(now.getDate(), now.getMonth() + 1, locale)}</p>
          <h2 id="home-today" className="mt-2 text-lg">{todays.length > 0 ? t("title") : t("monthTitle", { month })}</h2>
          <Link href="/calendar" className="text-link mt-3 inline-block text-sm font-medium">{t("all")}</Link>
        </div>
        <ul className="divide-y px-6 sm:px-8">
          {items.map((item, index) => (
            <li key={index} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr] sm:gap-6" lang={item.text_lang}>
              <span className="font-semibold tabular-nums text-primary">
                {item.day ? formatDayMonth(item.day, item.month, locale) : (item.date_text ?? month)}
                {item.event_year ? `, ${item.event_year}` : ""}
              </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
