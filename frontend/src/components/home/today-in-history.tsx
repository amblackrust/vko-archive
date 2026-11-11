import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MemorialDates } from "@/lib/api/home";
import { formatDayMonth, monthName } from "@/lib/dates";
import { Link } from "@/lib/i18n/navigation";

const MAX_ITEMS = 3;

/**
 * «Этот день в истории»: сегодняшние памятные даты из календаря архива, а если их нет — ближайшие в месяце.
 * Каждая дата — плитка «год крупно, под ним событие»; плитки делят ширину поровну, сколько бы их ни было.
 */
export function TodayInHistory({ dates, locale }: { dates: MemorialDates; locale: string }) {
  const t = useTranslations("home.today");
  const now = new Date();
  const todays = dates.items.filter((item) => item.is_today);
  const upcoming = dates.items.filter((item) => item.day === null || item.day >= now.getDate());
  const items = (todays.length > 0 ? todays : upcoming.length > 0 ? upcoming : dates.items).slice(0, MAX_ITEMS);
  if (items.length === 0) return null;
  const month = monthName(now.getMonth() + 1, locale);
  return (
    <section aria-labelledby="home-today" className="container-page py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <h2 id="home-today" className="text-2xl sm:text-[1.75rem]">{todays.length > 0 ? t("title") : t("monthTitle", { month })}</h2>
        <Link href="/calendar" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
          {t("all")} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="mt-6 grid auto-rows-fr gap-4 md:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
        {items.map((item, index) => (
          <li key={index} className="card flex gap-5 p-6" lang={item.text_lang}>
            {item.event_year && <p className="text-3xl font-bold tabular-nums leading-none text-primary">{item.event_year}</p>}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-muted-foreground">{item.day ? formatDayMonth(item.day, item.month, locale) : (item.date_text ?? month)}</p>
              <p className="mt-1">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
