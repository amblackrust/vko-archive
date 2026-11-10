import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/** Переключатели года и месяца; ссылки меняют query (?year=&month=), страница серверная. */
export function CalendarFilter({ years, year, month, monthNames }: {
  years: number[];
  year: number;
  month: number | null;
  monthNames: string[];
}) {
  const t = useTranslations("misc.calendar");
  const chip = (active: boolean) =>
    cn("rounded-full border px-3 py-1 text-sm", active ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-surface-muted");
  return (
    <div className="space-y-3">
      <nav aria-label={t("yearLabel")} className="flex flex-wrap gap-2">
        {years.map((y) => (
          <Link key={y} href={{ pathname: "/calendar", query: { year: y } }} className={chip(y === year)} aria-current={y === year ? "page" : undefined}>
            {y}
          </Link>
        ))}
      </nav>
      <nav aria-label={t("monthLabel")} className="flex flex-wrap gap-2">
        <Link href={{ pathname: "/calendar", query: { year } }} className={chip(month === null)} aria-current={month === null ? "page" : undefined}>
          {t("wholeYear")}
        </Link>
        {monthNames.map((name, i) => (
          <Link
            key={name}
            href={{ pathname: "/calendar", query: { year, month: i + 1 } }}
            className={chip(month === i + 1)}
            aria-current={month === i + 1 ? "page" : undefined}
          >
            {name}
          </Link>
        ))}
      </nav>
    </div>
  );
}
