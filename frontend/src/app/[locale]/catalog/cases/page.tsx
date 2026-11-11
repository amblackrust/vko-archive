import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { ListSearch } from "@/components/catalog/list-search";
import { Pagination } from "@/components/catalog/pagination";
import { TreeCard } from "@/components/catalog/tree-card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { catalogFetch, listPage, type CaseItem, type List, type SearchParams } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("tree.casesTitle"), alternates: localizedAlternates(locale, "/catalog/cases") };
}

export default async function CasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const query = listPage(await searchParams);
  const data = await catalogFetch<List<CaseItem>>("cases", query, locale);
  if (!data) throw new Error("catalog cases unavailable");
  return (
    <>
      <Breadcrumbs items={[{ label: t("title"), href: "/catalog" }, { label: t("tree.casesTitle") }]} />
      <div className="container-page space-y-6 pb-12">
        <h1 className="text-3xl font-bold">{t("tree.casesTitle")}</h1>
        <CatalogNav active="cases" />
        <ListSearch path="/catalog/cases" params={query} />
        <h2 className="font-medium">{t("results.count", { count: data.total })}</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {data.items.map((item) => (
            <li key={item.id}><TreeCard entry={{ kind: "case", item }} /></li>
          ))}
        </ul>
        <Pagination pathname="/catalog/cases" params={query} page={data.page} pages={data.pages} />
      </div>
    </>
  );
}
