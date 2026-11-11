"use client";

import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChoiceChips } from "@/components/memory/choice-chips";
import { EventBody } from "@/components/memory/event-body";
import { eventDate, themeLabel } from "@/components/memory/labels";
import { UnconfirmedTag } from "@/components/memory/provenance";
import { replaceQuery } from "@/components/memory/url-state";
import { DemoBadge } from "@/components/ui/demo-badge";
import { DemoTag } from "@/components/ui/demo-tag";
import { ExternalLink } from "@/components/ui/external-link";
import type { FacetCount, HistoricalEvent } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Place } from "./history-map";
import { HistoryMap } from "./history-map-loader";

/**
 * Историческая карта и равноценный ей список мест. Место выбирается и на карте, и в списке:
 * строка раскрывается описанием, источником и документами. Выбор и фильтр отражаются в адресе.
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
  const pickedOnMap = useRef(false);

  useEffect(() => replaceQuery({ kind, point: selected }), [kind, selected]);
  useEffect(() => {
    if (query.point) document.getElementById(`place-${query.point}`)?.scrollIntoView({ block: "nearest" });
  }, [query.point]);
  // После выбора на карте фокус переходит на строку списка: её содержимое сразу доступно с клавиатуры и диктору.
  useEffect(() => {
    if (pickedOnMap.current && selected) document.getElementById(`place-${selected}`)?.focus();
    pickedOnMap.current = false;
  }, [selected]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_27rem]">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <a href="#places-title" className="sr-only focus:not-sr-only focus:mb-2 focus:inline-block focus:rounded-md focus:border focus:bg-surface focus:px-3 focus:py-2 focus:text-sm">{t("skipMap")}</a>
        <div className="card h-80 overflow-hidden sm:h-96 lg:h-[calc(100vh-11rem)] lg:max-h-[44rem] lg:min-h-96">
          <HistoryMap
            places={visible}
            selected={selected}
            onSelect={(slug) => {
              pickedOnMap.current = true;
              setSelected(slug);
            }}
            label={t("map")}
            tileErrorText={t("tileError")}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("legend")}</p>
      </div>

      <section aria-labelledby="places-title" className="min-w-0 space-y-4">
        <h2 id="places-title" className="scroll-mt-28 text-2xl">{t("list.title")}</h2>
        <ChoiceChips
          legend={t("kind.label")}
          name="map-kind"
          value={kind}
          onChange={(value) => {
            setKind(value);
            setSelected(undefined);
          }}
          options={[{ value: "", label: t("kind.all"), count: places.length }, ...kinds.map((item) => ({ value: item.value, label: themeLabel(t, "kind", item.value), count: item.count }))]}
        />
        <p role="status" className="text-sm text-muted-foreground">{t("list.count", { count: visible.length })}</p>
        <ul className="card divide-y overflow-hidden">
          {visible.map((place) => {
            const open = place.slug === selected;
            const bodyId = `place-${place.slug}-body`;
            return (
              <li key={place.slug}>
                <h3>
                  <button
                    type="button"
                    id={`place-${place.slug}`}
                    aria-expanded={open}
                    aria-controls={open ? bodyId : undefined}
                    onClick={() => setSelected(open ? undefined : place.slug)}
                    className="group flex min-h-11 w-full scroll-mt-28 items-start justify-between gap-3 px-5 py-4 text-left hover:bg-surface-muted"
                  >
                    <span className="min-w-0">
                      <span className="block text-base leading-snug group-hover:text-primary sm:text-[1.0625rem]" lang={place.title_lang}>{place.title}</span>
                      <span className="mt-1 flex flex-wrap gap-x-3 text-sm font-normal tracking-normal text-muted-foreground">
                        {place.theme && <span>{themeLabel(t, "kind", place.theme)}</span>}
                        {place.place && <span>{place.place}</span>}
                      </span>
                    </span>
                    <ChevronDown className={cn("mt-1 size-5 shrink-0 text-muted-foreground", open && "rotate-180")} aria-hidden />
                  </button>
                </h3>
                {open && (
                  <div id={bodyId} className="space-y-4 px-5 pb-5 pt-1">
                    <p className="flex flex-wrap gap-2">
                      {place.is_demo && <DemoTag />}
                      {place.translation_missing && <DemoBadge kind="noTranslation" />}
                      <DemoBadge kind="approxCoords" />
                      {place.documents.length === 0 && <UnconfirmedTag />}
                    </p>
                    <EventBody event={place} date={eventDate(place, locale)}>
                      <ExternalLink href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=13/${place.lat}/${place.lng}`} className="text-link">{t("list.openMap")}</ExternalLink>
                      {place.year != null && <Link href={place.href} className="text-link">{t("list.timeline")}</Link>}
                    </EventBody>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
