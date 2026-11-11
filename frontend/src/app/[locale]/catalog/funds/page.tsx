import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { ListSearch } from "@/components/catalog/list-search";
import { Pagination } from "@/components/catalog/pagination";
import { TreeCard } from "@/components/catalog/tree-card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { catalogFetch, listPage, type FundItem, type List, type SearchParams } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("tree.fundsTitle"), alternates: localizedAlternates(locale, "/catalog/funds") };
}

export default async function FundsPage({
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
  const personal = query.get("type") === "personal";
  const data = await catalogFetch<List<FundItem>>("funds", query, locale);
  if (!data) throw new Error("catalog funds unavailable");
  const title = personal ? t("tree.personalTitle") : t("tree.fundsTitle");
  return (
    <>
      <Breadcrumbs items={[{ label: t("title"), href: "/catalog" }, { label: title }]} />
      <div className="container-page space-y-6 pb-12">
        <h1 className="text-3xl font-bold">{title}</h1>
        <CatalogNav active={personal ? "personalFunds" : "funds"} />
        <ListSearch path="/catalog/funds" params={query} />
        <h2 className="font-medium">{t("results.count", { count: data.total })}</h2>
        {data.items.length === 0 ? (
          <p className="text-muted-foreground">{t("tree.emptyFunds")}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.items.map((item) => (
              <li key={item.id}><TreeCard entry={{ kind: "fund", item }} /></li>
            ))}
          </ul>
        )}
        <Pagination pathname="/catalog/funds" params={query} page={data.page} pages={data.pages} />
      </div>
    </>
  );
}
