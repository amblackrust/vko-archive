"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, FileText, Hand, Search, X } from "lucide-react";
import type { Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { DragScroll } from "@/components/ui/drag-scroll";
import { IconButton } from "@/components/ui/icon-button";
import { SPRING_SHEET } from "@/lib/motion";

const PX = 90; // pixels per year
const GAP = 12; // empty stretches longer than this many years are shortened
const CARD = 216; // card width in px
const LANE = 108; // lane height in px

type Ev = Schema["EventItem"];
type Placed = { e: Ev; x: number; lane: number; up: boolean };

/** Events on a horizontal axis. Cards alternate above and below it and stack into lanes, so none overlap. */
export function TimelineView({ events, themes }: { events: Ev[]; themes: Schema["FacetCount"][] }) {
  const t = useTranslations("memory");
  const [theme, setTheme] = useState<string | null>(null);
  const [selected, setSelected] = useState<Ev | null>(null);
  const scroller = useRef<HTMLElement | null>(null);

  const dated = useMemo(() => events.filter((e) => e.year != null).sort((a, b) => (a.year as number) - (b.year as number)), [events]);
  // Long empty stretches (1720 → 1841) are shortened so the busy years get room.
  const { pos, ticks, total } = useMemo(() => {
    const years = [...new Set(dated.map((e) => e.year as number))];
    const start = (years[0] ?? 1900) - 5;
    const map = new Map<number, number>();
    const tickList: { year: number; at: number }[] = [];
    let at = 0;
    let prev = start;
    for (const y of [start, ...years, (years.at(-1) ?? 2000) + 5]) {
      const gap = y - prev;
      if (gap <= GAP) {
        for (let d = Math.ceil((prev + 1) / 10) * 10; d < y; d += 10) tickList.push({ year: d, at: at + (d - prev) * PX });
      }
      at += Math.min(gap, GAP) * PX;
      prev = y;
      map.set(y, at);
    }
    return { pos: map, ticks: tickList, total: at };
  }, [dated]);
  const width = total + CARD;

  const { placed, upLanes, downLanes } = useMemo(() => {
    const ends: Record<"up" | "down", number[]> = { up: [], down: [] };
    const out: Placed[] = dated.map((e, i) => {
      const x = pos.get(e.year as number) ?? 0;
      const side = i % 2 === 0 ? "up" : "down";
      let lane = ends[side].findIndex((end) => x >= end + 10);
      if (lane === -1) lane = ends[side].push(0) - 1;
      ends[side][lane] = x + CARD;
      return { e, x, lane, up: side === "up" };
    });
    return { placed: out, upLanes: Math.max(ends.up.length, 1), downLanes: Math.max(ends.down.length, 1) };
  }, [dated, pos]);
  const axisY = upLanes * LANE + 28;
  const height = axisY + downLanes * LANE + 28;

  const jumpYears = useMemo(() => [...new Set(dated.map((e) => Math.floor((e.year as number) / 10) * 10))].map((d) => dated.find((e) => (e.year as number) >= d)?.year as number), [dated]);
  const scrollBy = (dir: number) => scroller.current?.scrollBy({ left: dir * (scroller.current.clientWidth * 0.7), behavior: "smooth" });
  const jump = (year: number) => scroller.current?.scrollTo({ left: (pos.get(year) ?? 0) - 80, behavior: "smooth" });

  return (
    <div className="relative">
      <div className="wrap mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("title")}>
          {[{ value: null, label: t("timelineFilter.all") }, ...themes.map((x) => ({ value: x.value, label: t.has(`timelineFilter.${x.value}`) ? t(`timelineFilter.${x.value}`) : x.value }))].map((x) => (
            <button key={x.value ?? "all"} type="button" aria-pressed={theme === x.value} onClick={() => setTheme(x.value)} className={clsx("inline-flex h-10 items-center rounded-full px-4 transition-colors", theme === x.value ? "bg-ink text-table" : "bg-table-3 text-ink-2 hover:text-ink")}>{x.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden items-center gap-2 text-sm text-ink-3 md:flex"><Hand size={16} aria-hidden />{t("dragHint")}</p>
          <IconButton label={t("prev")} onClick={() => scrollBy(-1)}><ChevronLeft size={20} /></IconButton>
          <IconButton label={t("next")} onClick={() => scrollBy(1)}><ChevronRight size={20} /></IconButton>
        </div>
      </div>

      <div className="wrap mb-3 flex flex-wrap gap-1.5" aria-label={t("jump")}>
        {jumpYears.map((y) => (
          <button key={y} type="button" onClick={() => jump(y)} className="tnum rounded-full px-3 py-1 text-sm text-ink-2 transition-colors hover:bg-table-3 hover:text-ink">{y}</button>
        ))}
      </div>

      <DragScroll innerRef={scroller} as="div" label={t("title")} className="cursor-grab px-[var(--gutter)] pb-6 active:cursor-grabbing">
        <div className="relative shrink-0" style={{ width, height }}>
          <div aria-hidden className="absolute inset-x-0 border-t-2 border-ink" style={{ top: axisY }} />
          {ticks.map(({ year, at }) => (
            <div key={year} aria-hidden className="absolute h-3 -translate-y-1/2 border-l border-ink" style={{ left: at, top: axisY }}>
              <span className="edge absolute left-1/2 top-4 -translate-x-1/2 bg-table px-1">{year}</span>
            </div>
          ))}
          {/* Stems first, so every card paints over every stem. */}
          {placed.map(({ e, x, lane, up }) => {
            const top = up ? axisY - 24 - (lane + 1) * LANE + 12 : axisY + 24 + lane * LANE;
            const stem = up ? { top: top + LANE - 12, height: axisY - (top + LANE - 12) } : { top: axisY, height: top - axisY };
            return (
              <div key={e.slug} aria-hidden className={clsx("transition-opacity duration-300", theme && e.theme !== theme && "opacity-20")}>
                <span className="absolute w-px bg-line-strong" style={{ left: x, ...stem }} />
                <span className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-grease ring-4 ring-table" style={{ left: x, top: axisY }} />
              </div>
            );
          })}
          {placed.map(({ e, x, lane, up }) => {
            const top = up ? axisY - 24 - (lane + 1) * LANE + 12 : axisY + 24 + lane * LANE;
            return (
              <button
                key={e.slug}
                type="button"
                onClick={() => setSelected(e)}
                aria-label={`${e.year}: ${e.title}`}
                className={clsx("group absolute flex flex-col justify-center rounded-2xl border bg-table-2 px-4 py-3 text-left transition-[transform,border-color,box-shadow,opacity] duration-300 ease-(--ease-spring) hover:-translate-y-1 hover:border-action hover:shadow-lift", selected?.slug === e.slug ? "border-action" : "border-line", theme && e.theme !== theme && "opacity-20")}
                style={{ left: x, top, width: CARD - 20, height: LANE - 12 }}
              >
                <span className="flex items-center justify-between">
                  <span className="tnum font-display text-xl font-semibold tracking-[-0.03em]">{e.year}</span>
                  <ArrowRight size={16} className="text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-action" aria-hidden />
                </span>
                <span className="mt-0.5 line-clamp-2 text-[0.8125rem] leading-snug text-ink-2">{e.title}</span>
              </button>
            );
          })}
        </div>
      </DragScroll>

      <AnimatePresence>
        {selected && (
          <motion.aside initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={SPRING_SHEET} className="glass fixed inset-x-3 bottom-6 z-30 mx-auto max-h-[60dvh] max-w-[46rem] overflow-y-auto rounded-[28px] border border-line p-6 shadow-lift-high">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="edge">{selected.date_text ?? selected.year}</p>
                <h2 className="mt-1 text-2xl md:text-3xl">{selected.title}</h2>
              </div>
              <IconButton label="×" onClick={() => setSelected(null)}><X size={18} /></IconButton>
            </div>
            {selected.description && <p className="mt-4 text-ink-2">{selected.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-3">
              {selected.place && <span>{t("place")}: {selected.place}</span>}
              {selected.sources.map((s, i) => <span key={i}>{s.title}</span>)}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {selected.documents.map((d) => (
                <Link key={d.id} href={d.href} className="inline-flex h-11 items-center gap-2 rounded-full bg-action px-5 text-white no-underline transition-transform hover:scale-[1.02]">
                  <FileText size={18} aria-hidden />{t("openDocument")}: <span className="max-w-[16ch] truncate">{d.title}</span>
                </Link>
              ))}
              <Link href={`/search?q=${encodeURIComponent(selected.title)}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-table-3 px-5 no-underline hover:text-action">
                <Search size={18} aria-hidden />{t("findInArchive")}
              </Link>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
