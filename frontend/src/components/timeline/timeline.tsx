"use client";

import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { DocumentCard } from "@/components/catalog/document-card";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import type { FacetCount, HistoricalEvent } from "@/lib/api/memory";
import { cn } from "@/lib/utils";

const decadeOf = (year: number) => Math.floor(year / 10) * 10;

interface Props {
  events: HistoricalEvent[];
  themes: FacetCount[];
  /** Событие, открытое по ссылке ?event=slug. */
  initialSlug?: string;
}

/** Roving-tabindex: стрелки, Home/End двигают фокус по кнопкам шкалы, Enter/пробел выбирают. */
function useRovingKeys() {
  const ref = useRef<HTMLDivElement>(null);
  return {
    ref,
    onKeyDown(event: React.KeyboardEvent) {
      const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: buttons.length - 1 }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      buttons[(target + buttons.length) % buttons.length]?.focus();
    },
  };
}

function ScaleButton({ selected, onClick, children, tabbable }: { selected: boolean; onClick: () => void; children: React.ReactNode; tabbable: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      tabIndex={tabbable ? 0 : -1}
      onClick={onClick}
      className={cn(
        "relative flex min-h-11 min-w-20 shrink-0 flex-col items-center rounded-md border px-3 py-1.5 text-sm",
        selected ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

export function Timeline({ events, themes, initialSlug }: Props) {
  const t = useTranslations("timeline");
  const initial = events.find((e) => e.slug === initialSlug);
  const [theme, setTheme] = useState<string>("all");
  const [decade, setDecade] = useState<number | null>(initial?.year != null ? decadeOf(initial.year) : null);
  const [year, setYear] = useState<number | null>(initial?.year ?? null);
  const [open, setOpen] = useState<string | undefined>(initial?.slug);
  const decadeKeys = useRovingKeys();
  const yearKeys = useRovingKeys();

  const themed = useMemo(() => events.filter((e) => theme === "all" || e.theme === theme), [events, theme]);
  const decades = useMemo(() => {
    const counts = new Map<number, number>();
    for (const e of themed) if (e.year != null) counts.set(decadeOf(e.year), (counts.get(decadeOf(e.year)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }, [themed]);
  const years = useMemo(() => {
    if (decade == null) return [];
    const counts = new Map<number, number>();
    for (const e of themed) if (e.year != null && decadeOf(e.year) === decade) counts.set(e.year, (counts.get(e.year) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }, [themed, decade]);
  const visible = themed.filter((e) => e.year != null && (decade == null || decadeOf(e.year) === decade) && (year == null || e.year === year));

  function pickTheme(value: string) {
    setTheme(value);
    setOpen(undefined);
    // Выбранное десятилетие/год могут не иметь событий в новой теме.
    const rest = events.filter((e) => value === "all" || e.theme === value);
    if (decade != null && !rest.some((e) => e.year != null && decadeOf(e.year) === decade)) {
      setDecade(null);
      setYear(null);
    } else if (year != null && !rest.some((e) => e.year === year)) {
      setYear(null);
    }
  }
  function pickDecade(value: number | null) {
    setDecade(value);
    setYear(null);
    setOpen(undefined);
  }

  const themeButton = (value: string, label: string) => (
    <button
      key={value}
      type="button"
      aria-pressed={theme === value}
      onClick={() => pickTheme(value)}
      className={cn("min-h-9 rounded-full border px-3 text-sm", theme === value ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-surface-muted")}
    >
      {label}
    </button>
  );
  const themeName = (value: string) => (t.has(`theme.${value}`) ? t(`theme.${value}`) : value);

  return (
    <div className="space-y-6">
      <div role="group" aria-label={t("theme.label")} className="flex flex-wrap gap-2">
        {themeButton("all", t("theme.all"))}
        {themes.map((x) => themeButton(x.value, `${themeName(x.value)} (${x.count})`))}
      </div>

      <div className="space-y-3 rounded-lg border bg-surface p-4">
        <p className="text-xs text-muted-foreground">{t("scale.hint")}</p>
        <div ref={decadeKeys.ref} onKeyDown={decadeKeys.onKeyDown} role="toolbar" aria-label={t("scale.label")} className="flex gap-2 overflow-x-auto pb-2">
          <ScaleButton selected={decade == null} tabbable={decade == null} onClick={() => pickDecade(null)}>
            <span className="font-semibold">{t("scale.all")}</span>
            <span className="text-xs opacity-80">{t("scale.count", { count: themed.length })}</span>
          </ScaleButton>
          {decades.map(([value, count]) => (
            <ScaleButton key={value} selected={decade === value} tabbable={decade === value} onClick={() => pickDecade(value)}>
              <span className="font-semibold">{t("scale.decade", { decade: value })}</span>
              <span className="text-xs opacity-80">{t("scale.count", { count })}</span>
            </ScaleButton>
          ))}
        </div>
        {decade != null && (
          <div ref={yearKeys.ref} onKeyDown={yearKeys.onKeyDown} role="toolbar" aria-label={t("scale.years")} className="flex gap-2 overflow-x-auto border-t pt-3">
            <ScaleButton selected={year == null} tabbable={year == null} onClick={() => { setYear(null); setOpen(undefined); }}>
              <span className="font-semibold">{t("scale.all")}</span>
            </ScaleButton>
            {years.map(([value, count]) => (
              <ScaleButton key={value} selected={year === value} tabbable={year === value} onClick={() => { setYear(value); setOpen(undefined); }}>
                <span className="font-semibold">{value}</span>
                <span className="text-xs opacity-80">{t("scale.count", { count })}</span>
              </ScaleButton>
            ))}
          </div>
        )}
      </div>

      <section aria-labelledby="events-title" className="space-y-3">
        <h2 id="events-title" className="text-xl font-semibold">{t("list.title")}</h2>
        <p role="status" className="text-sm text-muted-foreground">{t("list.count", { count: visible.length })}</p>
        {visible.length === 0 ? (
          <div className="rounded-lg border p-4">
            <p>{t("list.empty")}</p>
            <button type="button" className="mt-2 text-primary hover:underline" onClick={() => { pickTheme("all"); pickDecade(null); }}>{t("list.reset")}</button>
          </div>
        ) : (
          <ol className="space-y-3 border-l-2 border-primary/40 pl-4">
            {visible.map((event) => (
              <EventCard key={event.slug} event={event} expanded={open === event.slug} onToggle={() => setOpen(open === event.slug ? undefined : event.slug)} themeName={themeName} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function EventCard({ event, expanded, onToggle, themeName }: { event: HistoricalEvent; expanded: boolean; onToggle: () => void; themeName: (v: string) => string }) {
  const t = useTranslations("timeline");
  const panelId = `event-${event.slug}`;
  return (
    <li id={panelId} className="relative rounded-lg border bg-surface p-4">
      <span aria-hidden className="absolute -left-[1.4rem] top-5 size-3 rounded-full border-2 border-primary bg-background" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="font-mono text-foreground">{event.date_text ?? event.year}</span>
        {event.theme && <span>{themeName(event.theme)}</span>}
        {event.is_demo && <DemoBadge />}
        {event.translation_missing && <DemoBadge kind="noTranslation" />}
      </div>
      <h3 className="mt-1 text-lg font-semibold leading-snug" lang={event.title_lang}>
        <button type="button" aria-expanded={expanded} aria-controls={`${panelId}-details`} onClick={onToggle} className="flex w-full items-start justify-between gap-2 text-left hover:underline">
          <span>{event.title}</span>
          {expanded ? <ChevronUp className="mt-1 size-4 shrink-0" aria-hidden /> : <ChevronDown className="mt-1 size-4 shrink-0" aria-hidden />}
          <span className="sr-only">{expanded ? t("event.close") : t("event.open")}</span>
        </button>
      </h3>
      {expanded && (
        <div id={`${panelId}-details`} className="mt-3 space-y-4">
          {event.description && <p>{event.description}</p>}
          {event.place && <p className="text-sm"><strong>{t("event.place")}:</strong> {event.place}</p>}
          <div>
            <h4 className="text-sm font-semibold">{t("event.sources")}</h4>
            <ul className="list-disc pl-5 text-sm">
              {event.sources.map((s, i) => <li key={i}>{s.title}</li>)}
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">{t("event.documents")}</h4>
            {event.documents.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{t("event.noDocuments")}</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {event.documents.map((d) => <li key={d.id}><DocumentCard item={d} /></li>)}
              </ul>
            )}
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {event.year != null && <Link href={`/catalog?year=${event.year}`} className="text-primary hover:underline">{t("event.toCatalog")}</Link>}
            {event.lat != null && <Link href="/memory/map" className="inline-flex items-center gap-1 text-primary hover:underline"><MapPin className="size-4" aria-hidden />{t("event.toMap")}</Link>}
          </p>
        </div>
      )}
    </li>
  );
}
