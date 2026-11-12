import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { api, type Schema } from "@/lib/api/client";
import { SearchForm } from "@/components/search/search-form";
import { AiSummary } from "@/components/search/ai-summary";
import { SmartChips } from "@/components/search/smart-chips";
import { FacetBar } from "@/components/search/facet-bar";
import { ResultsInspector } from "@/components/catalog/results-inspector";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import clsx from "clsx";

type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const PER = 20;

export default async function SearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  const type = arr(sp.types)[0];
  const offset = Math.max(0, Number(Array.isArray(sp.offset) ? sp.offset[0] : sp.offset) || 0);
  const [t, c, d, lang] = await Promise.all([getTranslations("search"), getTranslations("common"), getTranslations("dict"), getLocale()]);

  const res = q
    ? await api
        .get<Schema["SearchResponse"]>("/api/search", {
          query: { q, lang, types: type ? [type] : [], doc_type: arr(sp.doc_type), period: arr(sp.period), branch_id: arr(sp.branch_id), per_group: type ? PER : 5, offset: type ? offset : 0 },
          revalidate: 0,
        })
        .catch(() => null)
    : null;

  const link = (patch: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    s.set("q", q);
    for (const k of ["doc_type", "period", "branch_id"]) arr(sp[k]).forEach((v) => s.append(k, v));
    if (sp.f) s.set("f", "1");
    for (const [k, v] of Object.entries(patch)) if (v) s.set(k, v);
    return `/search?${s.toString()}`;
  };

  const tabs = res?.facets.type ?? [];

  return (
    <div className="wrap pb-10 pt-8 md:pt-10">
      <div className="max-w-[64rem]">
        <SearchForm initial={q} />
      </div>
      {q && (
        <div className="mt-8">
          {!sp.f && <SmartChips q={q} />}
          <AiSummary q={q} />
          {res && (
            <>
              <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
                <p className="text-lg"><span className="tnum font-medium">{t("results", { count: res.total })}</span> <span className="text-ink-3">{t("forQuery", { q })}</span></p>
                {res.semantic && <Badge tone="action">AI</Badge>}
              </div>
              {tabs.length > 0 && (
                <nav aria-label={t("title")} className="mb-6 flex flex-wrap gap-2">
                  <Link href={link({})} className={clsx("inline-flex h-10 items-center gap-2 rounded-full px-4 no-underline", !type ? "bg-ink text-table" : "bg-table-3 text-ink-2 hover:text-ink")}>{t("all")}</Link>
                  {tabs.map((f) => (
                    <Link key={f.value} href={link({ types: f.value })} className={clsx("inline-flex h-10 items-center gap-2 rounded-full px-4 no-underline", type === f.value ? "bg-ink text-table" : "bg-table-3 text-ink-2 hover:text-ink")}>
                      {c.has(`types.${f.value}`) ? c(`types.${f.value}`) : f.value} <span className="tnum text-xs opacity-70">{f.count}</span>
                    </Link>
                  ))}
                </nav>
              )}
              <FacetBar facets={{ doc_type: res.facets.doc_type ?? [], period: res.facets.period ?? [], branch: res.facets.branch ?? [] }} />
              {res.total === 0 ? (
                <EmptyState title={t("empty.title")}>{t("empty.text")}</EmptyState>
              ) : (
                <>
                  <ResultsInspector
                    groups={res.groups.map((g) => ({
                      type: g.type,
                      label: c.has(`types.${g.type}`) ? c(`types.${g.type}`) : g.type,
                      total: g.total,
                      more: !type && g.total > g.items.length ? <Link href={link({ types: g.type })} className={buttonClass("secondary", "", "sm")}>{c("more")}</Link> : undefined,
                      items: g.items.map((it) => ({
                        id: it.id, type: it.type, title: it.title, href: it.href, snippet: it.snippet,
                        doc: it.document ? { code: it.document.archive_code ?? "", date: it.document.date_text ?? "", docType: it.document.doc_type ?? "", access: it.document.file_access, digital: it.document.has_digital_copy, demo: false } : undefined,
                      })),
                    }))}
                  />
                  {type && res.groups[0] && (
                    <div className="mt-10 flex items-center justify-between">
                      {offset > 0 ? <Link href={link({ types: type, offset: String(Math.max(0, offset - PER)) })} className={buttonClass("secondary", "", "sm")}>{d("pagination.prev")}</Link> : <span />}
                      {offset + PER < res.groups[0].total ? <Link href={link({ types: type, offset: String(offset + PER) })} className={buttonClass("secondary", "", "sm")}>{d("pagination.next")}</Link> : <span />}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
