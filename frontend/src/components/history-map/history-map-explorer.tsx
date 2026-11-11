"use client";

import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { EventBody } from "@/components/memory/event-body";
import { eventDate, themeLabel } from "@/components/memory/labels";
import { replaceQuery } from "@/components/memory/url-state";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { SelectField } from "@/components/ui/field";
import type { FacetCount, HistoricalEvent } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import type { Place } from "./history-map";
import { HistoryMap } from "./history-map-loader";

/**
 * Историческая карта и равноценный ей список мест в одном окне. Слева — тип места и список; выбор в списке
 * или на карте открывает на месте списка описание, изображения, источник и документы. Выбор и фильтр отражаются в адресе.
 */
export function HistoryMapExplorer({ points, kinds, query }: {
  points: HistoricalEvent[];
  kinds: FacetCount[];
  query: Partial<Record<"kind" | "point", string>>;
}) {
  const t = useTranslations("historyMap");
  const locale = useLocale();
  const places = useMemo(() => points.filter((point): point is Place => point.lat != null && point.lng != null), [points]);
  const [selected, setSelected] = useState(() => places.find((place) => place.slug === query.point)?.slug);
  // Место, открытое по ссылке, важнее фильтра: иначе его могло бы не оказаться в списке.
  const [kind, setKind] = useState(() => (!selected && kinds.some((item) => item.value === query.kind) ? query.kind! : ""));
  const visible = useMemo(() => places.filter((place) => !kind || place.theme === kind), [places, kind]);
  const current = places.find((place) => place.slug === selected);
  const panel = useRef<HTMLDivElement>(null);
  const lastSelected = useRef<string | undefined>(undefined);
  const touched = useRef(false);

  useEffect(() => replaceQuery({ kind, point: selected }), [kind, selected]);
  // Фокус следует за выбором: описание читает экранный диктор и оно попадает в поле зрения на телефоне;
  // при возврате фокус встаёт на ту же строку списка. При открытии страницы по ссылке фокус не перехватывается.
  useEffect(() => {
    if (touched.current) {
      if (selected) panel.current?.focus();
      else if (lastSelected.current) document.getElementById(`place-${lastSelected.current}`)?.focus();
    }
    lastSelected.current = selected;
  }, [selected]);

  function select(slug: string | undefined) {
    touched.current = true;
    setSelected(slug);
  }

  return (
    <div>
      <a href="#places-panel" className="sr-only focus:not-sr-only focus:mb-2 focus:inline-block focus:rounded-md focus:border focus:bg-surface focus:px-3 focus:py-2 focus:text-sm">{t("skipMap")}</a>
      <div className="grid gap-6 lg:h-[calc(100dvh-9rem)] lg:max-h-[54rem] lg:min-h-[38rem] lg:grid-cols-[26rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-0 lg:overflow-hidden lg:rounded-lg lg:bg-surface lg:shadow-card">
        {!current && (
          <div className="lg:col-start-1 lg:row-start-1 lg:border-b lg:border-r lg:p-5">
            <SelectField
              label={t("kind.label")}
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              options={[
                { value: "", label: `${t("kind.all")} (${places.length})` },
                ...kinds.map((item) => ({ value: item.value, label: `${themeLabel(t, "kind", item.value)} (${item.count})` })),
              ]}
            />
          </div>
        )}

        <div className="h-80 overflow-hidden rounded-lg border sm:h-96 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto lg:rounded-none lg:border-0">
          <HistoryMap places={visible} selected={selected} onSelect={select} label={t("map")} tileErrorText={t("tileError")} />
        </div>

        {current ? (
          <div id="places-panel" ref={panel} tabIndex={-1} className="min-w-0 scroll-mt-28 space-y-5 outline-none lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:overflow-y-auto lg:border-r lg:p-5">
            <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => select(undefined)}>
              <ArrowLeft aria-hidden /> {t("list.back")}
            </Button>
            <div>
              <h2 className="text-xl leading-snug" lang={current.title_lang}>{current.title}</h2>
              {current.theme && <p className="mt-1 text-sm text-muted-foreground">{themeLabel(t, "kind", current.theme)}</p>}
            </div>
            <EventBody event={current} date={eventDate(current, locale)}>
              <ExternalLink href={`https://www.openstreetmap.org/?mlat=${current.lat}&mlon=${current.lng}#map=13/${current.lat}/${current.lng}`} className="text-link">{t("list.openMap")}</ExternalLink>
              {current.year != null && <Link href={current.href} className="text-link">{t("list.timeline")}</Link>}
            </EventBody>
          </div>
        ) : (
          <section id="places-panel" aria-labelledby="places-title" className="min-h-0 min-w-0 scroll-mt-28 lg:col-start-1 lg:row-start-2 lg:overflow-y-auto lg:border-r">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 lg:px-5 lg:pt-4">
              <h2 id="places-title" className="text-lg">{t("list.title")}</h2>
              <p role="status" className="text-sm text-muted-foreground">{t("list.count", { count: visible.length })}</p>
            </div>
            <ul className="mt-3 divide-y rounded-lg bg-surface px-5 shadow-card lg:mt-2 lg:rounded-none lg:bg-transparent lg:px-0 lg:shadow-none">
              {visible.map((place) => (
                <li key={place.slug}>
                  <button type="button" id={`place-${place.slug}`} onClick={() => select(place.slug)} className="group block w-full py-3 text-left lg:px-5 lg:hover:bg-surface-muted">
                    <span className="block font-semibold leading-snug group-hover:text-primary group-hover:underline" lang={place.title_lang}>{place.title}</span>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                      {place.theme && <span>{themeLabel(t, "kind", place.theme)}</span>}
                      {place.place && <span>{place.place}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
