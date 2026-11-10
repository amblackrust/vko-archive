"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DocumentCard } from "@/components/catalog/document-card";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import type { FacetCount, HistoricalEvent } from "@/lib/api/memory";
import { cn } from "@/lib/utils";
import { HistoryMap } from "./history-map-loader";

/** Карта + фильтр типа + список + карточка объекта. Список и карточка работают и без карты. */
export function HistoryExplorer({ points, kinds }: { points: HistoricalEvent[]; kinds: FacetCount[] }) {
  const t = useTranslations("historyMap");
  const [kind, setKind] = useState("all");
  const [selected, setSelected] = useState<string | undefined>();
  const visible = useMemo(() => points.filter((p) => kind === "all" || p.theme === kind), [points, kind]);
  const current = points.find((p) => p.slug === selected);
  const kindName = (value: string) => (t.has(`kind.${value}`) ? t(`kind.${value}`) : value);

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-3">
        <div role="group" aria-label={t("kind.label")} className="flex flex-wrap gap-2">
          {[{ value: "all", count: points.length }, ...kinds].map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={kind === k.value}
              onClick={() => { setKind(k.value); setSelected(undefined); }}
              className={cn("min-h-9 rounded-full border px-3 text-sm", kind === k.value ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-surface-muted")}
            >
              {kindName(k.value)} ({k.count})
            </button>
          ))}
        </div>
        <h2 className="text-lg font-semibold">{t("list.title")}</h2>
        <p role="status" className="text-sm text-muted-foreground">{t("list.count", { count: visible.length })}</p>
        {visible.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm">{t("list.empty")}</p>
        ) : (
          <ul className="max-h-[22rem] divide-y overflow-y-auto rounded-lg border bg-surface">
            {visible.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  aria-pressed={p.slug === selected}
                  onClick={() => setSelected(p.slug)}
                  className={cn("w-full px-3 py-2 text-left text-sm hover:bg-surface-muted", p.slug === selected && "bg-accent-soft text-accent-soft-foreground")}
                >
                  <span className="block font-medium" lang={p.title_lang}>{p.title}</span>
                  <span className="text-muted-foreground">{[p.theme && kindName(p.theme), p.place].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4">
        <div className="h-[22rem] overflow-hidden rounded-lg border sm:h-[28rem]">
          <HistoryMap points={visible} selected={selected} onSelect={setSelected} label={t("map")} tileErrorText={t("tileError")} />
        </div>
        <article className="rounded-lg border bg-surface p-4" aria-live="polite">
          {!current ? (
            <p className="text-muted-foreground">{t("card.none")}</p>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xl font-semibold" lang={current.title_lang}>
                {current.title}
                {current.is_demo && <DemoBadge className="ml-2 align-middle" />}
                <DemoBadge kind="approxCoords" className="ml-2 align-middle" />
              </h3>
              {current.description && <p>{current.description}</p>}
              <p className="text-sm text-muted-foreground">
                {[current.theme && kindName(current.theme), current.place && `${t("card.place")}: ${current.place}`, current.date_text].filter(Boolean).join(" · ")}
              </p>
              <div>
                <h4 className="text-sm font-semibold">{t("card.sources")}</h4>
                <ul className="list-disc pl-5 text-sm">{current.sources.map((s, i) => <li key={i}>{s.title}</li>)}</ul>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t("card.documents")}</h4>
                {current.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("card.noDocuments")}</p>
                ) : (
                  <ul className="grid gap-3 md:grid-cols-2">{current.documents.map((d) => <li key={d.id}><DocumentCard item={d} /></li>)}</ul>
                )}
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href={`https://www.openstreetmap.org/?mlat=${current.lat}&mlon=${current.lng}#map=13/${current.lat}/${current.lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {t("card.openMap")}<ExternalLink className="size-3.5" aria-hidden />
                </a>
                {current.year != null && <Link href={`/memory/timeline?event=${current.slug}`} className="text-primary hover:underline">{t("card.timeline")}</Link>}
              </p>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
