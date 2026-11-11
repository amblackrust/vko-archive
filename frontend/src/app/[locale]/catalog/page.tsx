import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActiveFilters } from "@/components/catalog/active-filters";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { CategoryTiles } from "@/components/catalog/category-tiles";
import { EmptyResults } from "@/components/catalog/empty-results";
import { DocumentCard } from "@/components/catalog/document-card";
import { FilterForm } from "@/components/catalog/filter-form";
import { Pagination } from "@/components/catalog/pagination";
import { SortLinks } from "@/components/catalog/sort-links";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { catalogFetch, catalogParams, type DocumentsResponse, type SearchParams } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/catalog") };
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const query = catalogParams(await searchParams);
  const data = await catalogFetch<DocumentsResponse>("documents", query, locale);
  // 422 от API (например, мусор в числовом поле) — показываем каталог без фильтров, а не 500.
  const result = data ?? (await catalogFetch<DocumentsResponse>("documents", new URLSearchParams(), locale));
  if (!result) throw new Error("catalog documents unavailable");
  const params_ = data ? query : new URLSearchParams();

  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
          <p className="text-sm text-muted-foreground">{t("tree.hierarchy")}</p>
        </header>
        <CatalogNav active="documents" />
        <CategoryTiles counts={result.facets.category} active={params_.get("category") ?? undefined} />
        <div className="grid gap-6 lg:grid-cols-[19rem_1fr]">
          <aside>
            <FilterForm params={params_} facets={result.facets} />
          </aside>
          <section aria-live="polite" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium">{t("results.count", { count: result.total })}</p>
              <SortLinks params={params_} active={result.sort} />
            </div>
            <ActiveFilters params={params_} facets={result.facets} />
            {result.items.length === 0 ? (
              <EmptyResults params={params_} locale={locale} />
            ) : (
              <ul className="space-y-3">
                {result.items.map((item) => (
                  <li key={item.id}>
                    <DocumentCard item={item} />
                  </li>
                ))}
              </ul>
            )}
            <p className="text-center text-sm text-muted-foreground">
              {t("results.page", { page: result.page, pages: result.pages })}
            </p>
            <Pagination pathname="/catalog" params={params_} page={result.page} pages={result.pages} />
          </section>
        </div>
      </div>
    </>
  );
}
