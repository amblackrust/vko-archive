"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search, X } from "lucide-react";
import clsx from "clsx";
import { useUrlParams } from "@/hooks/use-url-params";
import { periodLabel } from "@/lib/format";
import type { Schema } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";

type Facets = Schema["CatalogFacets"];
const SORTS = ["relevance", "date_asc", "date_desc", "code", "title"] as const;
const EXTRA = ["fund_number", "inventory_number", "case_number", "author", "place", "keyword", "date_from", "date_to"] as const;

export function CatalogFilters({ facets }: { facets: Facets }) {
  const t = useTranslations("catalog.filter");
  const d = useTranslations("dict");
  const { get, getAll, set, pending } = useUrlParams();
  const [q, setQ] = useState(get("q"));
  const [open, setOpen] = useState(EXTRA.some((k) => get(k)));

  // Typing waits a moment before the list is re-queried.
  useEffect(() => {
    const id = setTimeout(() => q !== get("q") && set({ q }), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const selects: { id: string; label: string; items: Facets["doc_type"]; text: (v: string, l?: string | null) => string }[] = [
    { id: "doc_type", label: t("docType"), items: facets.doc_type ?? [], text: (v) => (d.has(`docType.${v}`) ? d(`docType.${v}`) : v) },
    { id: "period", label: t("period"), items: facets.period ?? [], text: (v) => periodLabel(v, d("periodSuffix")) },
    { id: "language", label: t("language"), items: facets.language ?? [], text: (v) => (d.has(`language.${v}`) ? d(`language.${v}`) : v) },
    { id: "branch_id", label: t("branch"), items: facets.branch ?? [], text: (v, l) => l ?? v },
    { id: "topic", label: t("topic"), items: facets.topic ?? [], text: (v, l) => l ?? v },
    { id: "fund_type", label: t("fundType"), items: facets.fund_type ?? [], text: (v) => (d.has(`fundType.${v}`) ? d(`fundType.${v}`) : v) },
  ];

  const active = [
    ...selects.flatMap((s) => getAll(s.id).map((v) => ({ id: s.id, value: v, text: s.text(v, s.items.find((i) => i.value === v)?.label) }))),
    ...EXTRA.filter((k) => get(k)).map((k) => ({ id: k, value: get(k), text: `${t(({ fund_number: "fundNumber", inventory_number: "inventoryNumber", case_number: "caseNumber", author: "author", place: "place", keyword: "keyword", date_from: "from", date_to: "to" } as const)[k])}: ${get(k)}` })),
    ...(get("has_digital_copy") ? [{ id: "has_digital_copy", value: "true", text: t("digital") }] : []),
  ];

  const remove = (id: string, value: string) => set({ [id]: getAll(id).length > 1 ? getAll(id).filter((v) => v !== value) : null });

  return (
    <div aria-busy={pending} className={clsx("mb-8 transition-opacity", pending && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="field !rounded-full !pl-11" placeholder={useCatalogSearchPlaceholder()} aria-label={t("any")} />
        </div>
        <div className="w-56 max-sm:w-full">
          <Dropdown multiple={false} label={t("sort")} options={SORTS.map((x) => ({ value: x, label: d(`sort.${x}`) }))} value={[get("sort") || "relevance"]} onChange={([v]) => set({ sort: v === "relevance" ? null : v })} />
        </div>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 font-medium text-ink-2 hover:bg-mount-2">
          {t("more")} <ChevronDown size={16} className={clsx("transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </div>
      {/* Every filter is the same size, so the row reads as one tidy line. */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {selects.map((sel) =>
          sel.items.length ? (
            <Dropdown key={sel.id} label={sel.label} options={sel.items.map((i) => ({ value: i.value, label: sel.text(i.value, i.label), count: i.count }))} value={getAll(sel.id)} onChange={(v) => set({ [sel.id]: v })} />
          ) : null,
        )}
      </div>

      {open && (
        <div className="mt-4 grid gap-3 rounded-3xl border border-line bg-panel/60 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {EXTRA.map((k) => (
            <ExtraField key={k} name={k} label={t(({ fund_number: "fundNumber", inventory_number: "inventoryNumber", case_number: "caseNumber", author: "author", place: "place", keyword: "keyword", date_from: "from", date_to: "to" } as const)[k])} value={get(k)} onCommit={(v) => set({ [k]: v })} numeric={k.startsWith("date_")} />
          ))}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:col-span-2">
            <input type="checkbox" role="switch" className="size-5" checked={!!get("has_digital_copy")} onChange={(e) => set({ has_digital_copy: e.target.checked ? "true" : null })} />
            {t("digital")}
          </label>
        </div>
      )}

      {active.length > 0 && (
        <ul className="mt-4 flex flex-wrap items-center gap-2">
          {active.map((a) => (
            <li key={a.id + a.value}>
              <button type="button" onClick={() => remove(a.id, a.value)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-action-soft pl-3.5 pr-2 text-sm text-action hover:brightness-95">
                {a.text} <X size={14} aria-hidden /><span className="sr-only">{t("reset")}</span>
              </button>
            </li>
          ))}
          <li><Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries([...selects.map((s) => s.id), ...EXTRA, "has_digital_copy"].map((k) => [k, null])))}>{t("reset")}</Button></li>
        </ul>
      )}
    </div>
  );
}

function useCatalogSearchPlaceholder() {
  return useTranslations("catalog")("search");
}

function ExtraField({ name, label, value, onCommit, numeric }: { name: string; label: string; value: string; onCommit: (v: string) => void; numeric: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label>
      <span className="label">{label}</span>
      <input name={name} inputMode={numeric ? "numeric" : undefined} className="field" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onCommit(v)} onKeyDown={(e) => e.key === "Enter" && onCommit(v)} />
    </label>
  );
}
