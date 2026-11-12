import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import clsx from "clsx";
import { api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { PageHead } from "@/components/ui/page-head";

export default async function CalendarPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ year?: string; month?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const [t, lang, format] = await Promise.all([getTranslations("info.calendar"), getLocale(), getFormatter()]);
  const res = await api.get<Schema["MemorialDatesResponse"]>("/api/home/memorial-dates", { query: { lang, year, month }, revalidate: 0 }).catch(() => null);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const name = (m: number, f: "long" | "short" = "long") => format.dateTime(new Date(2000, m - 1, 1), { month: f });
  return (
    <>
      <PageHead title={t("title")} actions={
        <nav className="flex gap-2" aria-label={t("year")}>
          {[year - 1, year, year + 1].map((y) => <Link key={y} href={`/calendar?year=${y}&month=${month}`} className={clsx("tnum inline-flex h-10 items-center rounded-full px-4 no-underline", y === year ? "bg-ink text-table" : "bg-table-3 text-ink-2 hover:text-ink")}>{y}</Link>)}
        </nav>
      } />
      <div className="wrap">
        <nav aria-label={t("title")} className="mb-10 flex flex-wrap gap-1.5">
          {months.map((m) => <Link key={m} href={`/calendar?year=${year}&month=${m}`} aria-current={m === month ? "page" : undefined} className={clsx("inline-flex h-10 items-center rounded-full px-4 capitalize no-underline", m === month ? "bg-action text-action-ink" : "bg-table-3 text-ink-2 hover:text-ink")}>{name(m, "short")}</Link>)}
        </nav>
        <h2 className="mb-6 font-display text-[clamp(3rem,8vw,7rem)] font-semibold capitalize leading-none tracking-[-0.05em] text-grease">{name(month)} <span className="text-ink-3">{year}</span></h2>
        {res && res.items.length > 0 ? (
          <ul>
            {res.items.map((d, i) => (
              <li key={i} className="grid grid-cols-[5.5rem_1fr] gap-6 border-b border-line py-5 first:border-t md:grid-cols-[9rem_1fr]">
                <span className="tnum font-display text-4xl font-medium leading-none tracking-[-0.04em] md:text-5xl">{d.event_year}</span>
                <p className="self-center text-xl">{d.day ? <span className="mr-2 text-ink-3">{d.day}</span> : <span className="edge mr-2">{t("noDay")}</span>}{d.text}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-xl text-ink-3">{t("empty")}</p>}
      </div>
    </>
  );
}
