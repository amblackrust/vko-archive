import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { ListSearch } from "@/components/catalog/list-search";
import { Pagination } from "@/components/catalog/pagination";
import { TreeCard } from "@/components/catalog/tree-card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { catalogFetch, listPage, type InventoryItem, type List, type SearchParams } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("tree.inventoriesTitle"), alternates: localizedAlternates(locale, "/catalog/inventories") };
}

export default async function InventoriesPage({
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
  const data = await catalogFetch<List<InventoryItem>>("inventories", query, locale);
  if (!data) throw new Error("catalog inventories unavailable");
  return (
    <>
      <Breadcrumbs items={[{ label: t("title"), href: "/catalog" }, { label: t("tree.inventoriesTitle") }]} />
      <div className="container-page space-y-6 pb-12">
        <h1 className="text-3xl font-bold">{t("tree.inventoriesTitle")}</h1>
        <CatalogNav active="inventories" />
        <ListSearch path="/catalog/inventories" params={query} />
        <h2 className="font-medium">{t("results.count", { count: data.total })}</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {data.items.map((item) => (
            <li key={item.id}><TreeCard entry={{ kind: "inventory", item }} /></li>
          ))}
        </ul>
        <Pagination pathname="/catalog/inventories" params={query} page={data.page} pages={data.pages} />
      </div>
    </>
  );
}
