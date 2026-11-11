import { LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActiveFilters } from "@/components/catalog/active-filters";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { DocumentCard } from "@/components/catalog/document-card";
import { DocumentRow } from "@/components/catalog/document-row";
import { CATALOG_FORM, FilterPanel } from "@/components/catalog/filter-panel";
import { GetForm } from "@/components/catalog/get-form";
import { RecentStrip } from "@/components/catalog/recent";
import { SortSelect } from "@/components/catalog/sort-select";
import { LinkList } from "@/components/ui/link-list";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { RecordList } from "@/components/ui/record-list";
import { EmptyState, UnavailableState } from "@/components/ui/state-view";
import { catalogLoad, catalogParams, hasBlankParams, SORTS, withQuery, type DocumentsResponse, type SearchParams } from "@/lib/api/catalog";
import { Link, redirect } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("title"), description: t("intro"), alternates: localizedAlternates(locale, "/catalog") };
}

/** Документы каталога: строка поиска, фильтры со счётчиками, выдача плиткой или списком. Всё состояние — в адресе, страница работает без JS. */
export default async function CatalogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const raw = await searchParams;
  const requested = catalogParams(raw);
  if (hasBlankParams(raw)) redirect({ href: withQuery("/catalog", requested), locale });

  // Вид выдачи (плитка по умолчанию, список — view=list) — дело страницы: в запрос к API он не идёт.
  const list = requested.get("view") === "list";
  const api = (params: URLSearchParams) => {
    const out = new URLSearchParams(params);
    out.delete("view");
    if (!list) out.set("per_page", "24");
    return out;
  };

  // 422 от API (мусор в годе, дате или теме из адреса) — показываем весь каталог и говорим об этом, а не ошибку.
  let data = await catalogLoad<DocumentsResponse>("documents", api(requested), locale);
  const invalid = data === null;
  if (invalid) data = await catalogLoad<DocumentsResponse>("documents", api(new URLSearchParams()), locale);
  if (!data) return <UnavailableState />;
  const query = invalid ? new URLSearchParams() : requested;

  const filterCount = [...query.keys()].filter((key) => key !== "sort" && key !== "page" && key !== "view").length;
  const text = query.get("q") ?? "";
  const viewHref = (view: "grid" | "list") => {
    const out = new URLSearchParams(query);
    out.delete("page");
    if (view === "list") out.set("view", "list");
    else out.delete("view");
    return withQuery("/catalog", out);
  };
  const views = [
    { id: "grid", icon: LayoutGrid, current: !list },
    { id: "list", icon: List, current: list },
  ] as const;
  return (
    <>
      <PageHeader tone="brand" crumbs={[{ label: t("title") }]} title={t("title")} lead={t("intro")}>
        <GetForm
          key={query.toString()}
          id={CATALOG_FORM}
          pathname="/catalog"
          role="search"
          aria-label={t("search.label")}
          className="flex h-14 max-w-3xl items-center gap-2 rounded-2xl bg-white p-1.5 pl-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white"
        >
          <label htmlFor="catalog-q" className="sr-only">{t("search.field")}</label>
          <Search className="size-5 shrink-0 text-[#5a6478]" aria-hidden />
          <input
            id="catalog-q"
            name="q"
            type="search"
            defaultValue={text}
            placeholder={t("search.placeholder")}
            maxLength={200}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-base text-[#121a2b] placeholder:text-[#5a6478] focus-visible:outline-none"
          />
          {list && <input type="hidden" name="view" value="list" />}
          <button type="submit" className="h-full shrink-0 rounded-xl bg-[#3247d3] px-4 text-base font-semibold text-white hover:bg-[#2536b0] sm:px-7">{t("search.submit")}</button>
        </GetForm>
      </PageHeader>
      <div className="container-page space-y-6 pb-16">
        <CatalogNav active="documents" />
        <RecentStrip />

        <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside aria-labelledby="catalog-filters">
            <h2 id="catalog-filters" className="sr-only">{t("filters.heading")}</h2>
            {/* На телефоне фильтры свёрнуты, чтобы выдача была видна сразу; переключатель — чекбокс с подписью, работает без JS.
                key сворачивает панель и возвращает полям значения из адреса после каждого перехода. */}
            <input key={`toggle-${query}`} type="checkbox" id="filters-toggle" className="peer sr-only lg:hidden" />
            <label htmlFor="filters-toggle" className="card flex min-h-12 cursor-pointer items-center justify-center gap-2 font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring lg:hidden">
              <SlidersHorizontal className="size-4" aria-hidden />
              {t("filters.toggle", { count: filterCount })}
            </label>
            <div className="mt-3 hidden peer-checked:block lg:mt-0 lg:block">
              <FilterPanel key={query.toString()} params={query} facets={data.facets} />
            </div>
          </aside>

          <section aria-labelledby="catalog-results" className="min-w-0 space-y-4">
            {invalid && <Notice tone="warning">{t("search.invalid")}</Notice>}
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <h2 id="catalog-results" aria-live="polite" className="text-xl">{t("results.count", { count: data.total })}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <SortSelect
                  key={query.toString()}
                  form={CATALOG_FORM}
                  label={t("sort.label")}
                  defaultValue={query.get("sort") ?? ""}
                  options={SORTS.map((sort, index) => ({ value: index === 0 ? "" : sort, label: t(`sort.${sort}`) }))}
                />
                <ul aria-label={t("view.label")} className="flex rounded-md bg-surface p-1 shadow-card">
                  {views.map(({ id, icon: Icon, current }) => (
                    <li key={id}>
                      <Link
                        href={viewHref(id)}
                        aria-current={current ? "true" : undefined}
                        title={t(`view.${id}`)}
                        className={cn("grid size-8 place-items-center rounded-sm", current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary")}
                      >
                        <Icon className="size-4" aria-hidden />
                        <span className="sr-only">{t(`view.${id}`)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <ActiveFilters params={query} facets={data.facets} />
            {data.items.length === 0 ? (
              <div>
                <EmptyState as="h2" />
                <div className="mx-auto max-w-xl">
                  <LinkList
                    items={[
                      { href: text ? `/search?q=${encodeURIComponent(text)}` : "/search", label: t("empty.search.label"), text: t("empty.search.text") },
                      { href: "/catalog/funds", label: t("empty.funds.label"), text: t("empty.funds.text") },
                      { href: "/assistant", label: t("empty.assistant.label"), text: t("empty.assistant.text") },
                    ]}
                  />
                </div>
              </div>
            ) : list ? (
              <RecordList>{data.items.map((item) => <DocumentRow key={item.id} item={item} />)}</RecordList>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.items.map((item) => <DocumentCard key={item.id} item={item} />)}</ul>
            )}
            <Pagination pathname="/catalog" params={query} page={data.page} pages={data.pages} />
          </section>
        </div>
      </div>
    </>
  );
}
