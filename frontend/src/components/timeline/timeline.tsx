"use client";

import { MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useMemo, useState } from "react";
import { ChoiceChips } from "@/components/memory/choice-chips";
import { EventBody } from "@/components/memory/event-body";
import { eventDate, themeLabel } from "@/components/memory/labels";
import { replaceQuery } from "@/components/memory/url-state";
import { Button } from "@/components/ui/button";
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
 * справа линия времени: отметка на каждый год, рядом события этого года. Выбор отражается в адресе страницы.
 */
export function Timeline({ events, themes, query }: { events: HistoricalEvent[]; themes: FacetCount[]; query: TimelineQuery }) {
  const t = useTranslations("timeline");
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
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-x-10">
      <ChoiceChips
        className="lg:col-span-2"
        legend={t("theme.label")}
        name="timeline-theme"
        value={view.theme}
        onChange={pickTheme}
        options={[{ value: "", label: t("theme.all"), count: dated.length }, ...themes.map((item) => ({ value: item.value, label: themeLabel(t, "theme", item.value), count: item.count }))]}
      />
      {/* Шкала остаётся на экране при прокрутке списка; на телефоне это лента, которая листается вбок. */}
      <div className="card min-w-0 space-y-5 p-4 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto lg:p-5">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-semibold">{t("scale.label")}</legend>
          <div className="relative -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:overflow-visible lg:p-0">
            <span aria-hidden className="absolute bottom-5 left-3 top-5 hidden w-0.5 -translate-x-1/2 bg-primary/20 lg:block" />
            {[[null, themed.length] as const, ...decades].map(([decade, count]) => (
              <label
                key={decade ?? "all"}
                className="group relative flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-md pl-1.5 pr-2.5 text-[0.9375rem] hover:bg-surface-muted has-checked:bg-primary-soft has-checked:font-semibold has-checked:text-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring lg:min-h-10 lg:pr-2"
              >
                <input type="radio" name="timeline-decade" checked={view.decade === decade} onChange={() => pickDecade(decade)} className="peer sr-only" />
                {/* Отметка на шкале: у выбранного десятилетия она закрашена, не только другого цвета. */}
                <span aria-hidden className="relative size-3 shrink-0 rounded-full border-2 border-border-strong bg-surface peer-checked:border-primary peer-checked:bg-primary" />
                <span className="whitespace-nowrap tabular-nums">{decade == null ? t("scale.all") : t("scale.decade", { decade })}</span>
                {/* Полоска — доля событий десятилетия: на шкале видно, какие периоды представлены плотнее. */}
                <span aria-hidden className="hidden h-1.5 flex-1 lg:block">
                  {decade != null && <span className="block h-full rounded-full bg-border-strong/50 group-has-checked:bg-primary" style={{ width: `${(count / busiest) * 100}%` }} />}
                </span>
                <span aria-hidden className="tabular-nums text-muted-foreground group-has-checked:text-primary">{count}</span>
                <span className="sr-only">{t("scale.count", { count })}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {view.decade != null && (
          <ChoiceChips
            legend={t("scale.years", { decade: view.decade })}
            name="timeline-year"
            value={view.year == null ? "" : String(view.year)}
            onChange={(value) => setView({ theme: view.theme, decade: view.decade, year: value ? Number(value) : null })}
            options={[{ value: "", label: t("scale.allYears") }, ...years.map(([year, count]) => ({ value: String(year), label: String(year), count }))]}
          />
        )}
      </div>

      <section aria-labelledby="timeline-events" className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="timeline-events" className="text-2xl sm:text-3xl">{heading}</h2>
          <p className="flex flex-wrap items-baseline gap-x-4 text-sm text-muted-foreground">
            <span role="status">{t("list.count", { count: visible.length })}</span>
            {(view.theme || view.decade != null) && (
              <Button variant="link" className="h-11 px-0" onClick={() => setView({ theme: "", decade: null, year: null })}>{t("list.reset")}</Button>
            )}
          </p>
        </div>
        {/* Линия времени: ось проходит через отметки годов; слева год, справа события. На телефоне ось у левого края. */}
        <ol className="relative mt-6">
          <span aria-hidden className="absolute bottom-0 left-3 top-1 w-0.5 -translate-x-1/2 bg-primary/20 sm:left-[6.25rem]" />
          {groups.map(([year, items], index) => {
            const decade = decadeOf(year);
            const opensDecade = view.decade == null && (index === 0 || decadeOf(groups[index - 1][0]) !== decade);
            return (
              <Fragment key={year}>
                {opensDecade && (
                  <li className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] items-center pb-4 sm:grid-cols-[5rem_2.5rem_minmax(0,1fr)]">
                    <span aria-hidden className="relative col-start-1 h-0.5 w-3 justify-self-center bg-primary sm:col-start-2" />
                    <p className="col-start-2 pl-3 text-sm font-semibold text-muted-foreground sm:col-start-3 sm:pl-0">{t("list.decade", { decade })}</p>
                  </li>
                )}
                <li className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-y-2 pb-8 last:pb-0 sm:grid-cols-[5rem_2.5rem_minmax(0,1fr)]">
                  <p className="col-start-2 row-start-1 pl-3 text-2xl font-bold leading-8 tabular-nums sm:sticky sm:top-28 sm:col-start-1 sm:self-start sm:pl-0 sm:pt-4 sm:text-right">
                    <Link href={`/catalog?year=${year}`} title={t("list.catalog", { year })} aria-label={t("list.catalog", { year })} className="text-primary hover:underline">{year}</Link>
                  </p>
                  <span aria-hidden className="relative col-start-1 row-start-1 mt-2.5 size-3 justify-self-center rounded-full border-2 border-primary bg-surface sm:col-start-2 sm:mt-[1.625rem]" />
                  <ul className="col-start-2 row-start-2 min-w-0 space-y-3 pl-3 sm:col-start-3 sm:row-start-1 sm:pl-0">
                    {items.map((event) => (
                      <li
                        key={event.slug}
                        id={`event-${event.slug}`}
                        aria-current={event.slug === view.focus ? "true" : undefined}
                        className={cn("card scroll-mt-28 p-5 sm:p-6", event.slug === view.focus && "ring-2 ring-primary")}
                      >
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{eventDate(event, locale, false)}</span>
                          {event.theme && <span>{themeLabel(t, "theme", event.theme)}</span>}
                        </p>
                        <h3 className="mb-3 mt-1 text-[1.0625rem] font-semibold leading-snug [text-wrap:pretty]" lang={event.title_lang}>{event.title}</h3>
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
              </Fragment>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
