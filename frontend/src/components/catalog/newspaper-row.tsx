import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { NewspaperItem } from "@/lib/api/catalog";
import { cn } from "@/lib/utils";

/** Ось лет для полос «какие годы есть»: десятилетия, в которые укладываются все газеты страницы, но не уже 1930–2020. */
export function yearAxis(items: NewspaperItem[]): { from: number; to: number; ticks: number[] } {
  const from = Math.min(1930, ...items.map((item) => Math.floor(item.year_from / 10) * 10));
  const to = Math.max(2020, ...items.map((item) => Math.ceil(item.year_to / 10) * 10));
  const span = to - from;
  return { from, to, ticks: span % 30 === 0 ? [from, from + span / 3, from + (2 * span) / 3, to] : [from, to] };
}

/**
 * Газета в перечне: название, издатель, крайние годы и число томов; полоса показывает, за какие годы есть подшивки,
 * а полный список лет раскрывается по щелчку (`<details>`, работает без JS). `year` — год из фильтра: он выделен, список раскрыт.
 */
export function NewspaperRow({ item, axis, year }: { item: NewspaperItem; axis: { from: number; to: number }; year: number | null }) {
  const t = useTranslations("catalog");
  // В перечне архива каждый том — отдельная запись года: собираем число томов по годам.
  const volumes = new Map<number, number>();
  for (const entry of item.years) volumes.set(entry.year, (volumes.get(entry.year) ?? 0) + entry.volumes);
  const years = [...volumes.keys()].sort((a, b) => a - b);
  // Подряд идущие годы — один отрезок полосы.
  const runs: [number, number][] = [];
  for (const value of years) {
    const last = runs.at(-1);
    if (last && value === last[1] + 1) last[1] = value;
    else runs.push([value, value]);
  }
  const span = axis.to - axis.from;
  return (
    <li className="grid gap-x-8 gap-y-2 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-snug [text-wrap:pretty] sm:text-[1.0625rem]">{item.title}</h3>
        {item.publisher && <p className="mt-1 text-sm text-muted-foreground">{item.publisher}</p>}
      </div>
      <div>
        <p className="flex items-baseline gap-3 text-sm tabular-nums lg:justify-between">
          <span className="font-semibold">{item.year_from === item.year_to ? item.year_from : t("tree.years", { from: item.year_from, to: item.year_to })}</span>
          <span className="text-muted-foreground">{t("newspapers.volumes", { count: item.volumes_total })}</span>
        </p>
        <div className="relative mt-2 hidden h-2 overflow-hidden rounded-full bg-surface-muted lg:block" aria-hidden>
          {runs.map(([start, end]) => (
            <span
              key={start}
              className="absolute inset-y-0 min-w-1 rounded-full bg-primary"
              style={{ left: `${((start - axis.from) / span) * 100}%`, width: `${((end - start + 1) / span) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <details open={year !== null && volumes.has(year)} className="group text-sm lg:col-span-2">
        <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 font-semibold text-primary hover:underline [&::-webkit-details-marker]:hidden">
          {t("newspapers.years", { count: years.length })}
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="mt-1 flex flex-wrap gap-1.5 pb-1 tabular-nums">
          {years.map((value) => {
            const count = volumes.get(value) ?? 1;
            return (
              <li key={value} className={cn("rounded-md px-2.5 py-1", value === year ? "bg-primary font-semibold text-primary-foreground" : "bg-surface-muted")}>
                <span className="font-medium">{value}</span>
                {count > 1 && <span className={cn("ml-1.5", value !== year && "text-muted-foreground")}>{t("newspapers.volumes", { count })}</span>}
              </li>
            );
          })}
        </ul>
      </details>
    </li>
  );
}
