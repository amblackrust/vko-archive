import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { pageMeta } from "@/lib/seo";
import { api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { PageHead } from "@/components/ui/page-head";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { ResultsInspector } from "@/components/catalog/results-inspector";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import clsx from "clsx";

type SP = Record<string, string | string[] | undefined>;
const FILTER_KEYS = ["q", "title", "fund_number", "inventory_number", "case_number", "period", "year", "date_from", "date_to", "author", "topic", "place", "keyword", "doc_type", "branch_id", "category", "fund_type", "language", "has_digital_copy"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return pageMeta({ locale, path: "/catalog", title: t("title"), description: t("lead") });
}

export default async function CatalogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const [t, d, lang] = await Promise.all([getTranslations("catalog"), getTranslations("dict"), getLocale()]);
  const searching = FILTER_KEYS.some((k) => sp[k] !== undefined && sp[k] !== "") || sp.view === "search";

  const query: Record<string, string | string[] | number> = { lang, per_page: 25 };
  for (const k of [...FILTER_KEYS, "sort", "page"]) if (sp[k] !== undefined) query[k] = sp[k] as string | string[];
  const res = searching ? await api.get<Schema["DocumentsResponse"]>("/api/catalog/documents", { query, revalidate: 0 }).catch(() => null) : null;
  const facets = res?.facets ?? (await api.get<Schema["DocumentsResponse"]>("/api/catalog/documents", { query: { lang, per_page: 1 } }).catch(() => null))?.facets;

  const tab = (active: boolean) => clsx("inline-flex h-10 items-center rounded-full px-5 no-underline transition-colors", active ? "bg-ink text-table" : "bg-table-3 text-ink-2 hover:text-ink");
  const category = typeof sp.category === "string" ? sp.category : null;

  return (
    <>
      <PageHead
        title={category ? d(`category.${category}`) : t("title")}
        actions={
          <nav className="flex gap-2" aria-label={t("title")}>
            <Link href="/catalog" className={tab(!searching)}>{t("tabs.funds")}</Link>
            <Link href="/catalog?view=search" className={tab(searching)}>{t("tabs.documents")}</Link>
          </nav>
        }
      />
      <div className="wrap">
        {searching ? (
          <>
            {facets && <CatalogFilters facets={facets} />}
            {res && res.items.length > 0 ? (
              <>
                <p className="mb-5 text-ink-3"><span className="tnum">{t("found", { count: res.total })}</span></p>
                <ResultsInspector
                  groups={[{
                    type: "document", label: "", total: res.total,
                    items: res.items.map((x) => ({ id: x.id, type: "document", title: x.title, href: x.href, doc: { code: x.archive_code ?? "", date: x.date_text ?? "", docType: x.doc_type ?? "", access: x.file_access, digital: x.has_digital_copy, demo: x.is_demo, place: x.places?.[0] } })),
                  }]}
                />
                <Pagination page={res.page} pages={res.pages} basePath="/catalog" params={sp} />
              </>
            ) : (
              <EmptyState title={t("empty.title")}>{t("empty.text")}</EmptyState>
            )}
          </>
        ) : (
          <CatalogBrowser />
        )}
      </div>
    </>
  );
}
