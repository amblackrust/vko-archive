"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence } from "motion/react";
import { ArrowUpRight, FileText, Search } from "lucide-react";
import type { Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { BranchMap } from "@/components/map/branch-map-lazy";
import { DetailSheet } from "@/components/map/detail-sheet";

/** Events as points on a full-bleed map. A card rides on the marker; "details" zooms in and lifts a sheet with everything. */
export function HistoryMap({ events }: { events: Schema["EventItem"][] }) {
  const t = useTranslations("memory");
  const [slug, setSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);
  const points = useMemo(() => events.filter((e) => e.lat != null && e.lng != null).map((e) => ({ slug: e.slug, name: e.title, lat: e.lat as number, lng: e.lng as number })), [events]);
  const bySlug = useMemo(() => new Map(events.map((e) => [e.slug, e])), [events]);
  const sel = slug ? bySlug.get(slug) : undefined;
  const select = (s: string | null) => {
    setSlug(s);
    setDetail(false);
  };

  return (
    <section className="relative h-[calc(100dvh-3.75rem)] min-h-[30rem] overflow-hidden">
      <BranchMap
        branches={points}
        activeSlug={slug}
        onSelect={select}
        onClose={() => select(null)}
        detail={detail}
        className="absolute inset-0"
        scrollZoom
        renderCard={(s) => {
          const e = bySlug.get(s);
          if (!e) return null;
          return (
            <>
              <p className="edge">{e.date_text ?? e.year ?? t("noDate")}</p>
              <h2 className="mt-1 text-lg leading-snug">{e.title}</h2>
              {e.place && <p className="mt-1 text-xs text-ink-3">{e.place}</p>}
              <button type="button" onClick={() => setDetail(true)} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-action px-4 text-sm font-semibold text-action-ink">
                {t("more")} <ArrowUpRight size={14} aria-hidden />
              </button>
            </>
          );
        }}
      />
      {!slug && <p className="glass pointer-events-none absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-line px-5 py-2.5 text-sm text-ink-2 shadow-lift">{t("selectPoint")}</p>}
      <AnimatePresence>
        {detail && sel && (
          <DetailSheet key={sel.slug} onClose={() => setDetail(false)} backLabel={t("back")}>
            <p className="edge">{sel.date_text ?? sel.year ?? t("noDate")}</p>
            <h2 className="mt-1 text-3xl md:text-4xl">{sel.title}</h2>
            {sel.description && <p className="mt-4 max-w-[62ch] text-lg text-ink-2">{sel.description}</p>}
            <dl className="mt-5 grid gap-x-10 gap-y-3 text-ink-2 md:grid-cols-2">
              {sel.place && <div><dt className="edge">{t("place")}</dt><dd>{sel.place}</dd></div>}
              {sel.sources.length > 0 && <div><dt className="edge">{t("sourcesLabel")}</dt><dd>{sel.sources.map((x) => x.title).join("; ")}</dd></div>}
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              {sel.documents.map((d) => (
                <Link key={d.id} href={d.href} className="inline-flex h-11 items-center gap-2 rounded-full bg-action px-5 !text-white no-underline"><FileText size={18} aria-hidden />{t("openDocument")}: <span className="max-w-[18ch] truncate">{d.title}</span></Link>
              ))}
              <Link href={`/search?q=${encodeURIComponent(sel.title)}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-table-3 px-5 !text-ink no-underline"><Search size={18} aria-hidden />{t("findInArchive")}</Link>
            </div>
          </DetailSheet>
        )}
      </AnimatePresence>
    </section>
  );
}
