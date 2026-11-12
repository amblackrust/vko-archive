"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { api, type Schema } from "@/lib/api/client";
import { usePathname, useRouter } from "@/i18n/navigation";
import { DocPreview } from "./doc-preview";
import { DragScroll } from "@/components/ui/drag-scroll";

type Row = { id: string; code: string; title: string; meta?: string; demo?: boolean; digital?: boolean };
type Level = "fund" | "inventory" | "case" | "doc";
const KEYS: Level[] = ["fund", "inventory", "case", "doc"];

/** The fond → inventory → case → document hierarchy as columns: pick on the left, the next level opens on the right. */
export function CatalogBrowser() {
  const t = useTranslations("catalog.fund");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sel: Record<Level, string | null> = { fund: params.get("fund"), inventory: params.get("inventory"), case: params.get("case"), doc: params.get("doc") };
  const scroller = useRef<HTMLDivElement>(null);

  const choose = (level: Level, id: string) => {
    const next = new URLSearchParams(params.toString());
    const i = KEYS.indexOf(level);
    next.set(level, id);
    KEYS.slice(i + 1).forEach((k) => next.delete(k));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const back = () => {
    const next = new URLSearchParams(params.toString());
    const deepest = [...KEYS].reverse().find((k) => sel[k]);
    if (deepest) next.delete(deepest);
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  };

  const funds = useQuery({ queryKey: ["funds", locale], queryFn: () => api.get<Schema["FundsResponse"]>("/api/catalog/funds", { query: { lang: locale, per_page: 100 } }) });
  const fund = useQuery({ queryKey: ["fund", sel.fund, locale], enabled: !!sel.fund, queryFn: () => api.get<Schema["FundDetail"]>(`/api/catalog/funds/${sel.fund}`, { query: { lang: locale } }) });
  const inv = useQuery({ queryKey: ["inventory", sel.inventory, locale], enabled: !!sel.inventory, queryFn: () => api.get<Schema["InventoryDetail"]>(`/api/catalog/inventories/${sel.inventory}`, { query: { lang: locale, per_page: 100 } }) });
  const cs = useQuery({ queryKey: ["case", sel.case, locale], enabled: !!sel.case, queryFn: () => api.get<Schema["CaseDetail"]>(`/api/catalog/cases/${sel.case}`, { query: { lang: locale, per_page: 100 } }) });

  const columns: { level: Level; title: string; rows: Row[] | null }[] = [
    {
      level: "fund",
      title: t("title"),
      rows: funds.data?.items.map((f) => ({ id: f.id, code: t("number", { n: f.number }), title: f.title, meta: [f.dates_from && f.dates_to ? `${f.dates_from}–${f.dates_to}` : null, t("docCount", { count: f.document_count })].filter(Boolean).join(" · "), demo: f.is_demo })) ?? null,
    },
  ];
  if (sel.fund) columns.push({ level: "inventory", title: t("inventories"), rows: fund.data?.inventories.map((i) => ({ id: i.id, code: t("inventoryNumber", { n: i.number }), title: i.title, meta: [i.dates_text, t("caseCount", { count: i.case_count })].filter(Boolean).join(" · "), demo: i.is_demo })) ?? null });
  if (sel.inventory) columns.push({ level: "case", title: t("cases"), rows: inv.data?.cases.items.map((c) => ({ id: c.id, code: t("caseNumber", { n: c.number }), title: c.title, meta: [c.dates_text, t("docCount", { count: c.document_count })].filter(Boolean).join(" · "), demo: c.is_demo })) ?? null });
  if (sel.case) columns.push({ level: "doc", title: t("documents"), rows: cs.data?.documents.items.map((x) => ({ id: x.id, code: x.archive_code ?? "", title: x.title, meta: [x.date_text, x.places?.[0]].filter(Boolean).join(" · "), demo: x.is_demo, digital: x.has_digital_copy })) ?? null });

  const depth = columns.length;
  // The newest column scrolls into view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, [depth, sel.doc]);

  return (
    <div className="relative">
      <div className="mb-3 flex items-center md:hidden">
        <button type="button" onClick={back} disabled={depth === 1 && !sel.doc} className="inline-flex h-10 items-center gap-1 rounded-full bg-table-3 px-4 text-sm disabled:opacity-40"><ChevronLeft size={16} aria-hidden /> {t("title")}</button>
      </div>
      <DragScroll as="div" innerRef={scroller} className="-mx-[var(--gutter)] gap-0 px-[var(--gutter)] !py-0 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {columns.map((col, ci) => (
          <section
            key={col.level}
            aria-label={col.title}
            className={clsx(
              depth === 1 ? "w-full" : "w-[min(86vw,24rem)] shrink-0 border-line pr-5 md:w-[24rem] md:border-r md:pl-5 md:first:pl-0",
              // On phones only the deepest column is shown.
              ci < depth - 1 && "max-md:hidden",
            )}
          >
            <h2 className="mb-3 text-sm font-medium text-ink-3 font-sans tracking-normal">{col.title}</h2>
            <ColumnList level={col.level} rows={col.rows} selected={sel[col.level]} onChoose={(id) => choose(col.level, id)} wide={depth === 1} />
          </section>
        ))}
        {sel.doc && (
          <section aria-label="preview" className="w-[min(92vw,34rem)] shrink-0 md:pl-8">
            <DocPreview id={sel.doc} />
          </section>
        )}
      </DragScroll>
    </div>
  );
}

function ColumnList({ level, rows, selected, onChoose, wide }: { level: Level; rows: Row[] | null; selected: string | null; onChoose: (id: string) => void; wide?: boolean }) {
  const ref = useRef<HTMLUListElement>(null);
  if (!rows) return <ul className="space-y-2" aria-busy>{[0, 1, 2].map((i) => <li key={i} className="h-16 animate-pulse rounded-2xl bg-table-3" />)}</ul>;

  const move = (e: React.KeyboardEvent, i: number) => {
    const items = ref.current?.querySelectorAll<HTMLButtonElement>("button");
    if (!items) return;
    if (e.key === "ArrowDown") (items[i + 1] ?? items[i]).focus();
    else if (e.key === "ArrowUp") (items[i - 1] ?? items[i]).focus();
    else if (e.key === "ArrowRight" && level !== "doc") {
      onChoose(rows[i].id);
      setTimeout(() => (e.currentTarget.closest("div")?.querySelectorAll<HTMLButtonElement>("section:last-of-type button")[0])?.focus(), 400);
    } else return;
    e.preventDefault();
  };

  return (
    <ul ref={ref} role="listbox" className={wide ? "grid gap-x-8 gap-y-1.5 md:grid-cols-2 xl:grid-cols-3" : "space-y-1.5"}>
      {rows.map((r, i) => (
        <li key={r.id} role="option" aria-selected={selected === r.id}>
          <button
            type="button"
            onClick={() => onChoose(r.id)}
            onKeyDown={(e) => move(e, i)}
            className={clsx("group relative flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-[background-color,transform] duration-200 ease-(--ease-spring) active:scale-[0.99]", selected === r.id ? "bg-action text-action-ink" : "hover:bg-table-3")}
          >
            <span className="min-w-0 flex-1">
              <span className={clsx("edge block", selected === r.id && "!text-action-ink/75")}>{r.code}</span>
              <span className="mt-0.5 block font-display text-[1.05rem] font-medium leading-snug tracking-[-0.015em]">{r.title}</span>
              {r.meta && <span className={clsx("mt-0.5 block text-xs", selected === r.id ? "text-action-ink/75" : "text-ink-3")}>{r.meta}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 self-center">
              {r.digital && <ImageIcon size={14} className={selected === r.id ? "" : "text-ink-3"} aria-hidden />}
              
              {level !== "doc" && <ChevronRight size={16} className={selected === r.id ? "" : "text-ink-3"} aria-hidden />}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
