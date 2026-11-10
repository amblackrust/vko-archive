import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarFilter } from "@/components/misc/calendar-filter";
import { CalendarWidget } from "@/components/misc/calendar-widget";
import { fetchMemorialCalendar } from "@/components/misc/api";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { localizedAlternates } from "@/lib/seo";
import { TranslationNote } from "@/components/help/translation-note";
import { StateView, UnavailableState } from "@/components/ui/state-view";
import { CalendarDays } from "lucide-react";

/** Календарь данных есть за эти годы (seed «Календарь памятных дат»); другие годы не запрашиваем. */
const YEARS = [2022, 2023, 2024, 2025, 2026];

function monthNames(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => formatter.format(new Date(Date.UTC(2026, i, 1))));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "misc.calendar" });
  return { title: t("title"), description: t("intro"), alternates: localizedAlternates(locale, "/calendar") };
}

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const t = await getTranslations("misc.calendar");
  const currentYear = new Date().getFullYear();
  const defaultYear = YEARS.includes(currentYear) ? currentYear : YEARS[YEARS.length - 1];
  const year = YEARS.find((y) => String(y) === query.year) ?? defaultYear;
  const monthValue = Number(query.month);
  const month = Number.isInteger(monthValue) && monthValue >= 1 && monthValue <= 12 ? monthValue : null;
  const names = monthNames(locale);
  const calendar = await fetchMemorialCalendar(locale, year, month ?? undefined);

  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-8 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
          <p className="text-sm text-muted-foreground">{t("range")}</p>
        </header>

        <CalendarFilter years={YEARS} year={year} month={month} monthNames={names} />

        {!calendar ? (
          <UnavailableState />
        ) : calendar.items.length === 0 ? (
          <StateView icon={CalendarDays} as="h2" title={t("empty")} />
        ) : (
          <ul className="space-y-3">
            {calendar.items.map((item, index) => (
              <li key={index} className="rounded-lg border bg-surface p-4 space-y-1">
                <p className="font-medium">
                  {item.day
                    ? `${item.day} ${names[item.month - 1]}`
                    : item.date_text ?? t("noDay")}
                  {item.event_year && <span className="text-muted-foreground"> · {item.event_year}</span>}
                </p>
                <p lang={item.text_lang}>{item.text}</p>
                <TranslationNote requested={locale} actual={item.text_lang} status="verified" />
              </li>
            ))}
          </ul>
        )}

        <CalendarWidget locale={locale} />
      </div>
    </>
  );
}
