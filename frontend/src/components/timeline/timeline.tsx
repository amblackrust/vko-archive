"use client";

import { MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { ChoiceChips } from "@/components/memory/choice-chips";
import { EventBody } from "@/components/memory/event-body";
import { eventDate, themeLabel } from "@/components/memory/labels";
import { UnconfirmedTag } from "@/components/memory/provenance";
import { replaceQuery } from "@/components/memory/url-state";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { DemoTag } from "@/components/ui/demo-tag";
import { Notice } from "@/components/ui/notice";
import type { FacetCount, HistoricalEvent } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

type Dated = HistoricalEvent & { year: number };
interface View {
  theme: string;
  decade: number | null;
  year: number | null;
  /** Событие, открытое по ссылке ?event=slug: подсвечено, пока посетитель не сменил период. */
  focus?: string;
}
export type TimelineQuery = Partial<Record<"theme" | "decade" | "year" | "event", string>>;

const decadeOf = (year: number) => Math.floor(year / 10) * 10;
const inTheme = (events: Dated[], theme: string) => events.filter((event) => !theme || event.theme === theme);

/** Число событий по десятилетиям или годам, по возрастанию. */
function tally(events: Dated[], key: (year: number) => number): [number, number][] {
  const counts = new Map<number, number>();
  for (const event of events) counts.set(key(event.year), (counts.get(key(event.year)) ?? 0) + 1);
  return [...counts].sort((a, b) => a[0] - b[0]);
}

/** Состояние из адреса; значения, которых нет в данных, отбрасываются. */
function fromQuery(events: Dated[], themes: FacetCount[], query: TimelineQuery): View {
  const target = events.find((event) => event.slug === query.event);
  if (target) return { theme: "", decade: decadeOf(target.year), year: null, focus: target.slug };
  const theme = themes.some((item) => item.value === query.theme) ? query.theme! : "";
  const themed = inTheme(events, theme);
  const decade = themed.some((event) => decadeOf(event.year) === Number(query.decade)) ? Number(query.decade) : null;
  const year = decade != null && themed.some((event) => event.year === Number(query.year) && decadeOf(event.year) === decade) ? Number(query.year) : null;
  return { theme, decade, year };
}

/**
 * Хронология: слева шкала десятилетий (настоящие радиокнопки — работает с клавиатуры без своей логики),
 * справа события выбранного периода по годам. Выбор отражается в адресе страницы.
 */
export function Timeline({ events, themes, query }: { events: HistoricalEvent[]; themes: FacetCount[]; query: TimelineQuery }) {
  const t = useTranslations("timeline");
  const tp = useTranslations("memory.provenance");
  const locale = useLocale();
  const dated = useMemo(() => events.filter((event): event is Dated => event.year != null), [events]);
  const [view, setView] = useState(() => fromQuery(dated, themes, query));

  useEffect(() => replaceQuery({ theme: view.theme, decade: view.decade, year: view.year, event: view.focus }), [view]);
  useEffect(() => {
    if (query.event) document.getElementById(`event-${query.event}`)?.scrollIntoView({ block: "center" });
  }, [query.event]);

  const themed = inTheme(dated, view.theme);
  const decades = tally(themed, decadeOf);
  const busiest = Math.max(...decades.map(([, count]) => count));
  const years = view.decade == null ? [] : tally(themed.filter((event) => decadeOf(event.year) === view.decade), (year) => year);
  const visible = themed.filter((event) => (view.decade == null || decadeOf(event.year) === view.decade) && (view.year == null || event.year === view.year));
  // События приходят в хронологическом порядке, поэтому соседние записи одного года образуют группу.
  const groups: [number, Dated[]][] = [];
  for (const event of visible) {
    if (groups.at(-1)?.[0] === event.year) groups.at(-1)![1].push(event);
    else groups.push([event.year, [event]]);
  }

  function pickTheme(theme: string) {
    // В новой теме у выбранного десятилетия или года может не быть событий: тогда период сбрасывается.
    const rest = inTheme(dated, theme);
    const decade = rest.some((event) => decadeOf(event.year) === view.decade) ? view.decade : null;
    setView({ theme, decade, year: decade != null && rest.some((event) => event.year === view.year) ? view.year : null });
  }
  const pickDecade = (decade: number | null) => setView({ theme: view.theme, decade, year: null });

  const heading = view.year != null ? t("list.year", { year: view.year }) : view.decade != null ? t("list.decade", { decade: view.decade }) : t("list.all");

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_1fr] lg:gap-x-8">
      <ChoiceChips
        className="lg:col-span-2"
        legend={t("theme.label")}
        name="timeline-theme"
        value={view.theme}
        onChange={pickTheme}
        options={[{ value: "", label: t("theme.all"), count: dated.length }, ...themes.map((item) => ({ value: item.value, label: themeLabel(t, "theme", item.value), count: item.count }))]}
      />
      {/* Шкала остаётся на экране при прокрутке списка; если десятилетий много, прокручивается сама. */}
      <div className="card space-y-5 p-4 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
        <fieldset>
          <legend className="mb-1 px-2 text-sm font-medium">{t("scale.label")}</legend>
          <div className="grid grid-cols-2 gap-x-2 sm:grid-cols-3 lg:grid-cols-1">
            {[[null, themed.length] as const, ...decades].map(([decade, count]) => (
              <label key={decade ?? "all"} className="group flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-[0.9375rem] hover:bg-surface-muted has-checked:bg-primary-soft has-checked:font-semibold has-checked:text-primary lg:min-h-10">
                <input type="radio" name="timeline-decade" checked={view.decade === decade} onChange={() => pickDecade(decade)} className="size-4 shrink-0 accent-primary" />
                <span>{decade == null ? t("scale.all") : t("scale.decade", { decade })}</span>
                {/* Полоска — доля событий десятилетия: на шкале видно, какие периоды представлены плотнее. */}
                <span aria-hidden className="hidden h-1.5 flex-1 lg:block">
                  {decade != null && <span className="block h-full rounded-full bg-border-strong group-has-checked:bg-primary" style={{ width: `${(count / busiest) * 100}%` }} />}
                </span>
                <span aria-hidden className="ml-auto tabular-nums text-muted-foreground lg:ml-0">{count}</span>
                <span className="sr-only">{t("scale.count", { count })}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {view.decade != null && (
          <ChoiceChips
            className="px-2"
            legend={t("scale.years", { decade: view.decade })}
            name="timeline-year"
            value={view.year == null ? "" : String(view.year)}
            onChange={(value) => setView({ theme: view.theme, decade: view.decade, year: value ? Number(value) : null })}
            options={[{ value: "", label: t("scale.allYears") }, ...years.map(([year, count]) => ({ value: String(year), label: String(year), count }))]}
          />
        )}
      </div>

      <section aria-labelledby="timeline-events" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="timeline-events" className="text-2xl">{heading}</h2>
          <p className="flex flex-wrap items-baseline gap-x-4 text-sm text-muted-foreground">
            <span role="status">{t("list.count", { count: visible.length })}</span>
            {(view.theme || view.decade != null) && (
              <Button variant="link" className="h-11 px-0" onClick={() => setView({ theme: "", decade: null, year: null })}>{t("list.reset")}</Button>
            )}
          </p>
        </div>
        {/* Пояснение к пометке даётся один раз над списком, а не у каждого события. */}
        {visible.some((event) => event.documents.length === 0) && (
          <Notice>
            <UnconfirmedTag /> <span className="mt-1 block">{tp("unconfirmedHint")}</span>
          </Notice>
        )}
        <ol className="space-y-4">
          {groups.map(([year, items]) => (
            <li key={year} className="card grid gap-x-8 gap-y-4 p-5 sm:grid-cols-[7rem_1fr] sm:p-6">
              <div className="sm:sticky sm:top-28 sm:self-start">
                <p className="text-3xl font-bold leading-none tabular-nums text-primary">{year}</p>
                <Link href={`/catalog?year=${year}`} className="text-link mt-2 inline-block text-sm">{t("list.catalog", { year })}</Link>
              </div>
              <ul className="min-w-0 space-y-8">
                {items.map((event) => (
                  <li
                    key={event.slug}
                    id={`event-${event.slug}`}
                    aria-current={event.slug === view.focus ? "true" : undefined}
                    className={cn("scroll-mt-28", event.slug === view.focus && "rounded-md bg-primary-soft p-4 ring-2 ring-primary")}
                  >
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{eventDate(event, locale, false)}</span>
                      {event.theme && <span>{themeLabel(t, "theme", event.theme)}</span>}
                      {event.is_demo && <DemoTag />}
                      {event.translation_missing && <DemoBadge kind="noTranslation" />}
                      {event.documents.length === 0 && <UnconfirmedTag />}
                    </p>
                    <h3 className="mb-3 mt-1 text-lg" lang={event.title_lang}>{event.title}</h3>
                    <EventBody event={event}>
                      {event.lat != null && (
                        <Link href={`/memory/map?point=${event.slug}`} className="text-link inline-flex items-center gap-1">
                          <MapPin className="size-4" aria-hidden />
                          {t("list.toMap")}
                        </Link>
                      )}
                    </EventBody>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
