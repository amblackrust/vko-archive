import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { CaseRow, groupAdjacent, GroupHead, LevelGroup, LevelList } from "@/components/catalog/hierarchy";
import { ListHero } from "@/components/catalog/list-hero";
import { UnavailableState } from "@/components/ui/state-view";
import { catalogList, listPage, type CaseItem, type List, type SearchParams } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog.tree" });
  return { title: t("casesTitle"), description: t("casesLead"), alternates: localizedAlternates(locale, "/catalog/cases") };
}

/** Все опубликованные дела: поиск по номеру и названию, дела сгруппированы по описям. */
export default async function CasesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const query = listPage(await searchParams);
  const data = await catalogList<List<CaseItem>>("cases", query, locale);
  if (!data) return <UnavailableState />;
  return (
    <>
      <ListHero
        crumbs={[{ label: t("title"), href: "/catalog" }, { label: t("tree.casesTitle") }]}
        title={t("tree.casesTitle")}
        lead={t("tree.casesLead")}
        pathname="/catalog/cases"
        formKey={query.toString()}
        formLabel={t("tree.casesTitle")}
        input={{ id: "cases-q", label: t("tree.search"), placeholder: t("tree.casesPlaceholder"), value: query.get("q") ?? "" }}
        submit={t("tree.searchSubmit")}
      />
      <div className="container-page space-y-6 pb-16">
        <CatalogNav active="cases" />
        <LevelList pathname="/catalog/cases" query={query} list={data} empty={t("tree.emptyList")}>
          <div className="space-y-6">
            {groupAdjacent(data.items, (item) => item.inventory.id).map((group) => {
              const { fund, inventory } = group[0];
              return (
                <LevelGroup
                  key={group[0].id}
                  head={<GroupHead href={inventory.href} code={t("tree.cipher.inventory", { fund: fund.number, inventory: inventory.number })} title={inventory.title} fund={fund} />}
                >
                  {group.map((item) => <CaseRow key={item.id} item={item} heading="h4" />)}
                </LevelGroup>
              );
            })}
          </div>
        </LevelList>
      </div>
    </>
  );
}
