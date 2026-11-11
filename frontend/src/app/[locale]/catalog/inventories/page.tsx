import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { groupAdjacent, GroupHead, InventoryRow, LevelGroup, LevelList } from "@/components/catalog/hierarchy";
import { ListHero } from "@/components/catalog/list-hero";
import { UnavailableState } from "@/components/ui/state-view";
import { catalogList, listPage, type InventoryItem, type List, type SearchParams } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog.tree" });
  return { title: t("inventoriesTitle"), description: t("inventoriesLead"), alternates: localizedAlternates(locale, "/catalog/inventories") };
}

/** Все опубликованные описи: поиск по номеру и названию, описи сгруппированы по фондам. */
export default async function InventoriesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const query = listPage(await searchParams);
  const data = await catalogList<List<InventoryItem>>("inventories", query, locale);
  if (!data) return <UnavailableState />;
  return (
    <>
      <ListHero
        crumbs={[{ label: t("title"), href: "/catalog" }, { label: t("tree.inventoriesTitle") }]}
        title={t("tree.inventoriesTitle")}
        lead={t("tree.inventoriesLead")}
        pathname="/catalog/inventories"
        formKey={query.toString()}
        formLabel={t("tree.inventoriesTitle")}
        input={{ id: "inventories-q", label: t("tree.search"), placeholder: t("tree.inventoriesPlaceholder"), value: query.get("q") ?? "" }}
        submit={t("tree.searchSubmit")}
      />
      <div className="container-page space-y-6 pb-16">
        <CatalogNav active="inventories" />
        <LevelList pathname="/catalog/inventories" query={query} list={data} empty={t("tree.emptyList")}>
          <div className="space-y-6">
            {groupAdjacent(data.items, (item) => item.fund.id).map((group) => {
              const fund = group[0].fund;
              return (
                <LevelGroup key={group[0].id} head={<GroupHead href={fund.href} code={t("tree.fundOf", { number: fund.number })} title={fund.title} />}>
                  {group.map((item) => <InventoryRow key={item.id} item={item} heading="h4" />)}
                </LevelGroup>
              );
            })}
          </div>
        </LevelList>
      </div>
    </>
  );
}
