import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { InventoryRow, LevelList } from "@/components/catalog/hierarchy";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableState } from "@/components/ui/state-view";
import { catalogList, listPage, type InventoryItem, type List, type SearchParams } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog.tree" });
  return { title: t("inventoriesTitle"), description: t("inventoriesLead"), alternates: localizedAlternates(locale, "/catalog/inventories") };
}

/** Все опубликованные описи: общий список с поиском по номеру и названию. */
export default async function InventoriesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const query = listPage(await searchParams);
  const data = await catalogList<List<InventoryItem>>("inventories", query, locale);
  if (!data) return <UnavailableState />;
  return (
    <>
      <PageHeader crumbs={[{ label: t("title"), href: "/catalog" }, { label: t("tree.inventoriesTitle") }]} title={t("tree.inventoriesTitle")} lead={t("tree.inventoriesLead")} />
      <div className="container-page space-y-6 py-8 pb-16">
        <CatalogNav active="inventories" />
        <LevelList pathname="/catalog/inventories" query={query} list={data} empty={t("tree.emptyList")}>
          {data.items.map((item) => <InventoryRow key={item.id} item={item} full />)}
        </LevelList>
      </div>
    </>
  );
}
