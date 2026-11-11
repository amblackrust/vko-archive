import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TreeCard } from "@/components/catalog/tree-card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { catalogFetch, type FundDetail } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  const x = await catalogFetch<FundDetail>(`funds/${encodeURIComponent(id)}`, new URLSearchParams(), locale);
  return { title: x ? x.title : t("title"), alternates: localizedAlternates(locale, `/catalog/funds/${id}`) };
}

export default async function FundPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const fund = await catalogFetch<FundDetail>(`funds/${encodeURIComponent(id)}`, new URLSearchParams(), locale);
  if (!fund) notFound();
  return (
    <>
      <Breadcrumbs
        items={[
          { label: t("title"), href: "/catalog" },
          { label: t("tree.fundsTitle"), href: "/catalog/funds" },
          { label: t("tree.fundOf", { number: fund.number }) },
        ]}
      />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("tree.fundOf", { number: fund.number })}</p>
          <h1 className="text-3xl font-bold" lang={fund.title_lang}>
            {fund.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("tree.fundType", { type: t(`fundTypes.${fund.type}`) })}
            {fund.dates_from && fund.dates_to ? ` · ${t("tree.years", { from: fund.dates_from, to: fund.dates_to })}` : ""}
            {` · ${t("tree.counts.documents", { count: fund.document_count })}`}
          </p>
          {fund.annotation && <p className="max-w-3xl">{fund.annotation}</p>}
        </header>
        <h2 className="text-xl font-semibold">{t("tree.inventoriesInFund")}</h2>
        {fund.inventories.length === 0 ? (
          <p className="text-muted-foreground">{t("tree.emptyInventories")}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {fund.inventories.map((item) => (
              <li key={item.id}><TreeCard entry={{ kind: "inventory", item }} /></li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
