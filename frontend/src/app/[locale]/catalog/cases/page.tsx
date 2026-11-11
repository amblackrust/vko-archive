import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { CaseRow, LevelList } from "@/components/catalog/hierarchy";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableState } from "@/components/ui/state-view";
import { catalogList, listPage, type CaseItem, type List, type SearchParams } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog.tree" });
  return { title: t("casesTitle"), description: t("casesLead"), alternates: localizedAlternates(locale, "/catalog/cases") };
}

/** Все опубликованные дела: общий список с поиском по номеру и названию. */
export default async function CasesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const query = listPage(await searchParams);
  const data = await catalogList<List<CaseItem>>("cases", query, locale);
  if (!data) return <UnavailableState />;
  return (
    <>
      <PageHeader crumbs={[{ label: t("title"), href: "/catalog" }, { label: t("tree.casesTitle") }]} title={t("tree.casesTitle")} lead={t("tree.casesLead")} />
      <div className="container-page space-y-6 py-8 pb-16">
        <CatalogNav active="cases" />
        <LevelList pathname="/catalog/cases" query={query} list={data} empty={t("tree.emptyList")}>
          {data.items.map((item) => <CaseRow key={item.id} item={item} full />)}
        </LevelList>
      </div>
    </>
  );
}
