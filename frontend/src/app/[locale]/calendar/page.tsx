import { getTranslations, setRequestLocale } from "next-intl/server";
import { TranslationNote } from "@/components/help/translation-note";
import { fetchMemorialCalendar } from "@/components/misc/api";
import { pageMetadata } from "@/components/misc/metadata";
import { Unavailable } from "@/components/misc/state-help";
import { PageHeader } from "@/components/ui/page-header";
import { TabsNav } from "@/components/ui/tabs-nav";
import { formatDayMonth, monthName } from "@/lib/dates";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/** Календарь передан архивом за эти годы; другие годы не запрашиваем. */
const YEARS = [2022, 2023, 2024, 2025, 2026];
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export const generateMetadata = pageMetadata("misc.calendar", "/calendar");

/** Календарь памятных дат: год вкладками, месяц — рядом ссылок, даты — списком по месяцам. */
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
  const isToday = (item: { day: number | null; month: number }) => year === now.getFullYear() && item.month === now.getMonth() + 1 && item.day === now.getDate();
  const chip = "flex min-h-11 items-center rounded-md border px-3 text-[0.9375rem] capitalize hover:border-primary hover:text-primary";

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <div className="container-page">
        <TabsNav label={t("yearLabel")} active={String(year)} items={YEARS.map((value) => ({ id: String(value), href: `/calendar?year=${value}`, label: String(value) }))} />
      </div>
      <div className="container-page space-y-10 py-8 pb-16">
        <nav aria-label={t("monthLabel")}>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link href={`/calendar?year=${year}`} aria-current={month ? undefined : "page"} className={cn(chip, "normal-case", !month && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground")}>
                {t("wholeYear")}
              </Link>
            </li>
            {MONTHS.map((value) => (
              <li key={value}>
                <Link href={`/calendar?year=${year}&month=${value}`} aria-current={month === value ? "page" : undefined} className={cn(chip, month === value && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground")}>
                  {monthName(value, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {foreign && <TranslationNote requested={locale} actual={foreign.text_lang} />}

        {calendar.items.length === 0 && (
          <div className="card max-w-2xl space-y-2 p-6">
            <h2 className="text-lg">{t("empty")}</h2>
            <p className="text-muted-foreground">{t("emptyText")}</p>
            {month && <p><Link href={`/calendar?year=${year}`} className="text-link font-medium">{t("emptyLink", { year })}</Link></p>}
          </div>
        )}

        {MONTHS.filter((value) => calendar.items.some((item) => item.month === value)).map((value) => (
          <section key={value} aria-labelledby={`month-${value}`} className="grid gap-x-10 gap-y-3 lg:grid-cols-[13rem_minmax(0,1fr)]">
            <h2 id={`month-${value}`} className="text-2xl capitalize">{monthName(value, locale)}</h2>
            <ul className="card max-w-3xl divide-y px-5 sm:px-6">
              {calendar.items.filter((item) => item.month === value).map((item, index) => (
                <li key={index} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <p className="font-semibold tabular-nums">
                    {item.day ? formatDayMonth(item.day, item.month, locale) : <span className="font-normal text-muted-foreground">{t("noDay")}</span>}
                    {isToday(item) && <span className="ml-2 rounded-sm bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">{t("today")}</span>}
                  </p>
                  <p lang={item.text_lang}>{item.text}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="max-w-3xl text-sm text-muted-foreground">{t("source")}</p>
      </div>
    </>
  );
}
