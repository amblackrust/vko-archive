"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import { ArrowUpRight, Clock, Mail, MapPin, Phone, Search, UserRound } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { BranchMap } from "@/components/map/branch-map-lazy";
import { DetailSheet } from "@/components/map/detail-sheet";
import { Badge } from "@/components/ui/badge";
import type { Schema } from "@/lib/api/client";

/** One screen, no navigation: the map fills it, the list floats on the left, the chosen branch opens in a panel at the bottom. */
export function BranchesExplorer({ branches }: { branches: Schema["BranchItem"][] }) {
  const t = useTranslations("branches");
  const [q, setQ] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(useSearchParams().get("open"));
  const [detail, setDetail] = useState(false);
  const select = (slug: string | null) => {
    setActive(slug);
    setDetail(false);
  };
  const types = useMemo(() => [...new Set(branches.map((b) => b.type))], [branches]);
  const shown = branches.filter((b) => (!type || b.type === type) && (!q || `${b.name} ${b.address}`.toLowerCase().includes(q.toLowerCase())));
  const points = useMemo(() => shown.filter((b) => b.show_on_map && b.lat != null && b.lng != null).map((b) => ({ slug: b.slug, name: b.name, lat: b.lat as number, lng: b.lng as number, head: b.type === "head" })), [shown]);
  const sel = branches.find((b) => b.slug === active);
  const routes = sel && sel.lat != null && sel.lng != null
    ? [
        { id: "2gis", url: `https://2gis.kz/?m=${sel.lng},${sel.lat}/16` },
        { id: "google", url: `https://www.google.com/maps/dir/?api=1&destination=${sel.lat},${sel.lng}` },
        { id: "yandex", url: `https://yandex.kz/maps/?rtext=~${sel.lat},${sel.lng}&rtt=auto` },
      ]
    : [];

  return (
    <section className="relative h-[calc(100dvh-3.75rem)] min-h-[34rem] overflow-hidden">
      <BranchMap
        branches={points}
        activeSlug={active}
        onSelect={select}
        onClose={() => select(null)}
        detail={detail}
        className="absolute inset-0"
        scrollZoom
        renderCard={(slug) => {
          const b = branches.find((x) => x.slug === slug);
          if (!b) return null;
          return (
            <>
              <h2 className="text-lg leading-snug">{b.name}</h2>
              <p className="mt-1 text-sm text-ink-2">{b.address}</p>
              {b.phone && <p className="tnum mt-1 text-sm text-ink-3">{b.phone}</p>}
              <button type="button" onClick={() => setDetail(true)} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-action px-4 text-sm font-semibold text-action-ink">
                {t("more")} <ArrowUpRight size={14} aria-hidden />
              </button>
            </>
          );
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-[1000] flex items-start p-3 md:p-6">
        <div className={clsx("glass pointer-events-auto flex max-h-[calc(100dvh-11rem)] w-full max-w-[26rem] flex-col rounded-[28px] border border-line p-5 shadow-lift-high transition-[opacity,transform] duration-500", sel && "hidden md:flex", detail && "md:pointer-events-none md:-translate-x-6 md:opacity-0")}>
          <h1 className="mb-4 text-3xl md:text-4xl">{t("title")}</h1>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
            <input className="field !rounded-full !pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group">
            {[null, ...types].map((x) => (
              <button key={x ?? "all"} type="button" aria-pressed={type === x} onClick={() => setType(x)} className={clsx("h-8 rounded-full px-3 text-sm transition-colors", type === x ? "bg-ink text-table" : "bg-table-3 text-ink-2 hover:text-ink")}>
                {x ? (t.has(`type.${x}`) ? t(`type.${x}`) : x) : t("all")}
              </button>
            ))}
          </div>
          <ul className="-mx-2 mt-3 min-h-0 overflow-y-auto">
            {shown.length === 0 && <li className="px-2 py-3 text-ink-3">{t("nothing")}</li>}
            {shown.map((b) => (
              <li key={b.slug}>
                <button type="button" onClick={() => select(b.slug)} className={clsx("block w-full rounded-xl px-2 py-2.5 text-left transition-colors", active === b.slug ? "bg-table-3" : "hover:bg-table-2")}>
                  <span className="block font-medium">{b.name}</span>
                  <span className="block text-xs text-ink-3">{b.address}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <AnimatePresence>
        {detail && sel && (
          <DetailSheet key={sel.slug} onClose={() => select(null)} backLabel={t("back")}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone="action">{t.has(`type.${sel.type}`) ? t(`type.${sel.type}`) : sel.type}</Badge>
              {!sel.coords_verified && <Badge tone="warn">{t("approx")}</Badge>}
            </div>
            <h2 className="text-3xl md:text-4xl">{sel.name}</h2>
            <ul className="mt-4 grid gap-x-10 gap-y-2 text-ink-2 md:grid-cols-2">
              <li className="flex items-start gap-2"><MapPin size={16} className="mt-1 shrink-0 text-ink-3" aria-hidden />{sel.address}</li>
              {sel.hours && <li className="flex items-start gap-2"><Clock size={16} className="mt-1 shrink-0 text-ink-3" aria-hidden />{sel.hours}</li>}
              {sel.director && <li className="flex items-start gap-2"><UserRound size={16} className="mt-1 shrink-0 text-ink-3" aria-hidden /><span><span className="text-ink-3">{t("director")}: </span>{sel.director}</span></li>}
              {sel.phone && <li className="flex items-start gap-2"><Phone size={16} className="mt-1 shrink-0 text-ink-3" aria-hidden /><a href={`tel:${sel.phone.replace(/[^\d+]/g, "")}`} className="tnum no-underline hover:text-action">{sel.phone}</a></li>}
              {sel.email && <li className="flex items-start gap-2"><Mail size={16} className="mt-1 shrink-0 text-ink-3" aria-hidden /><a href={`mailto:${sel.email}`} className="no-underline hover:text-action">{sel.email}</a></li>}
            </ul>
            {sel.description && <p className="mt-5 max-w-[66ch] text-lg text-ink-2">{sel.description}</p>}
            {sel.funds_summary && <p className="mt-4 max-w-[66ch] text-ink-2"><span className="edge mr-2">{t("funds")}</span>{sel.funds_summary}</p>}
            {routes.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-sm text-ink-3">{t("route")}</p>
                <div className="flex flex-wrap gap-2">
                  {routes.map((r, i) => (
                    <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className={clsx("inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm no-underline", i === 0 ? "bg-action !text-white" : "bg-table-3 !text-ink")}>
                      {t(`providers.${r.id}`)} <ArrowUpRight size={14} aria-hidden />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </DetailSheet>
        )}
      </AnimatePresence>
    </section>
  );
}
