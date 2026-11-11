import { getTranslations, setRequestLocale } from "next-intl/server";
import { TranslationNote } from "@/components/help/translation-note";
import { fetchMemorialCalendar } from "@/components/misc/api";
import { pageMetadata } from "@/components/misc/metadata";
import { Unavailable } from "@/components/misc/state-help";
import { PageHeader } from "@/components/ui/page-header";
import { formatDayMonth, monthName } from "@/lib/dates";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/** Календарь передан архивом за эти годы; другие годы не запрашиваем. */
const YEARS = [2022, 2023, 2024, 2025, 2026];
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export const generateMetadata = pageMetadata("misc.calendar", "/calendar");

/** Ряд ссылок-фильтров (год или месяц): состояние хранится в адресе, работает без скриптов. */
function FilterRow({ label, items }: { label: string; items: { href: string; label: string; current: boolean; capitalize?: boolean }[] }) {
  return (
    <nav aria-label={label} className="grid gap-x-4 gap-y-2 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-baseline">
      <p className="text-sm text-muted-foreground" aria-hidden>{label}</p>
      <ul className="-mx-1 flex flex-wrap gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center rounded-md px-2.5 text-[0.9375rem] font-medium tabular-nums",
                item.capitalize && "capitalize",
                item.current ? "bg-primary text-primary-foreground" : "hover:bg-primary-soft hover:text-primary",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Календарь памятных дат: год и месяц — ссылки-фильтры, месяцы — карточки в две колонки, текущий месяц и сегодняшняя дата выделены. */
export default async function CalendarPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ year?: string; month?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const t = await getTranslations("misc.calendar");
  const now = new Date();
  const year = YEARS.find((value) => String(value) === query.year) ?? (YEARS.includes(now.getFullYear()) ? now.getFullYear() : YEARS[YEARS.length - 1]);
  const month = MONTHS.find((value) => String(value) === query.month) ?? null;
  const calendar = await fetchMemorialCalendar(locale, year, month);
  if (!calendar) return <Unavailable />;

  const foreign = calendar.items.find((item) => item.text_lang !== locale);
  const thisYear = year === now.getFullYear();
  const isToday = (item: { day: number | null; month: number }) => thisYear && item.month === now.getMonth() + 1 && item.day === now.getDate();
  const months = MONTHS.filter((value) => calendar.items.some((item) => item.month === value));

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <div className="container-page space-y-8 pb-16 pt-4">
        <div className="card space-y-3 p-5 sm:p-6">
          <FilterRow
            label={t("yearLabel")}
            items={YEARS.map((value) => ({ href: `/calendar?year=${value}`, label: String(value), current: value === year }))}
          />
          <FilterRow
            label={t("monthLabel")}
            items={[
              { href: `/calendar?year=${year}`, label: t("wholeYear"), current: !month },
              ...MONTHS.map((value) => ({ href: `/calendar?year=${year}&month=${value}`, label: monthName(value, locale), current: month === value, capitalize: true })),
            ]}
          />
        </div>

        {foreign && <TranslationNote requested={locale} actual={foreign.text_lang} />}

        {months.length === 0 && (
          <div className="card max-w-2xl space-y-2 p-6">
            <h2 className="text-lg">{t("empty")}</h2>
            <p className="text-muted-foreground">{t("emptyText")}</p>
            {month && <p><Link href={`/calendar?year=${year}`} className="text-link font-medium">{t("emptyLink", { year })}</Link></p>}
          </div>
        )}

        {/* Карточки месяцев идут колонками (сверху вниз, затем вправо): высота карточки равна числу дат, пустот между ними нет. */}
        <div className={cn("gap-4", months.length > 1 && "lg:columns-2")}>
          {months.map((value) => {
            const current = thisYear && value === now.getMonth() + 1;
            const items = calendar.items.filter((item) => item.month === value);
            return (
              <section key={value} aria-labelledby={`month-${value}`} className={cn("card mb-4 break-inside-avoid overflow-hidden", current && "shadow-[inset_0_0_0_2px_var(--primary)]!")}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-5 py-4 sm:px-6">
                  <h2 id={`month-${value}`} className="text-xl capitalize">{monthName(value, locale)}</h2>
                  {current && (
                    <p className="flex items-center gap-2 text-sm font-medium text-primary">
                      <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                      {t("today")}, {formatDayMonth(now.getDate(), value, locale)}
                    </p>
                  )}
                </div>
                <ul className="divide-y">
                  {items.map((item, index) => (
                    <li key={index} className={cn("grid gap-x-5 gap-y-1 px-5 py-3.5 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:px-6", isToday(item) && "bg-primary-soft")}>
                      <p className={cn("font-semibold tabular-nums", isToday(item) && "text-primary")}>
                        {item.day ? formatDayMonth(item.day, item.month, locale) : <span className="font-normal text-muted-foreground">{t("noDay")}</span>}
                      </p>
                      <p lang={item.text_lang}>{item.text}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
