import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListSearch } from "@/components/catalog/list-search";
import { Pagination } from "@/components/catalog/pagination";
import { TreeCard } from "@/components/catalog/tree-card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import { catalogFetch, listPage, type InventoryDetail, type SearchParams } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  const x = await catalogFetch<InventoryDetail>(`inventories/${encodeURIComponent(id)}`, new URLSearchParams(), locale);
  return { title: x ? x.title || t("tree.inventoryOf", { number: x.number }) : t("title"), alternates: localizedAlternates(locale, `/catalog/inventories/${id}`) };
}

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const query = listPage(await searchParams);
  const inventory = await catalogFetch<InventoryDetail>(`inventories/${encodeURIComponent(id)}`, query, locale);
  if (!inventory) notFound();
  const path = `/catalog/inventories/${inventory.id}`;
  return (
    <>
      <Breadcrumbs
        items={[
          { label: t("title"), href: "/catalog" },
          { label: t("tree.fundsTitle"), href: "/catalog/funds" },
          { label: t("tree.fundOf", { number: inventory.fund.number }), href: inventory.fund.href },
          { label: t("tree.inventoryOf", { number: inventory.number }) },
        ]}
      />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <Link href={inventory.fund.href} className="hover:underline">
              {t("tree.up")}: {t("tree.fundOf", { number: inventory.fund.number })}. {inventory.fund.title}
            </Link>
          </p>
          <h1 className="text-3xl font-bold" lang={inventory.title_lang}>
            {inventory.title || t("tree.inventoryOf", { number: inventory.number })}
            {inventory.is_demo && <DemoBadge className="ml-3 align-middle" />}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[inventory.dates_text, t("tree.counts.cases", { count: inventory.case_count }), t("tree.counts.documents", { count: inventory.document_count })]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </header>
        <h2 className="text-xl font-semibold">{t("tree.casesInInventory")}</h2>
        <ListSearch path={path} params={query} />
        {inventory.cases.items.length === 0 ? (
          <p className="text-muted-foreground">{t("tree.emptyCases")}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {inventory.cases.items.map((item) => (
              <li key={item.id}><TreeCard entry={{ kind: "case", item }} /></li>
            ))}
          </ul>
        )}
        <Pagination pathname={path} params={query} page={inventory.cases.page} pages={inventory.cases.pages} />
      </div>
    </>
  );
}
