import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocumentCard } from "@/components/catalog/document-card";
import { ListSearch } from "@/components/catalog/list-search";
import { Pagination } from "@/components/catalog/pagination";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import { catalogFetch, listPage, type CaseDetail, type SearchParams } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  const x = await catalogFetch<CaseDetail>(`cases/${encodeURIComponent(id)}`, new URLSearchParams(), locale);
  return { title: x ? x.title || t("tree.caseOf", { number: x.number }) : t("title"), alternates: localizedAlternates(locale, `/catalog/cases/${id}`) };
}

export default async function CasePage({
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
  const item = await catalogFetch<CaseDetail>(`cases/${encodeURIComponent(id)}`, query, locale);
  if (!item) notFound();
  const path = `/catalog/cases/${item.id}`;
  return (
    <>
      <Breadcrumbs
        items={[
          { label: t("title"), href: "/catalog" },
          { label: t("tree.fundsTitle"), href: "/catalog/funds" },
          { label: t("tree.fundOf", { number: item.fund.number }), href: item.fund.href },
          { label: t("tree.inventoryOf", { number: item.inventory.number }), href: item.inventory.href },
          { label: t("tree.caseOf", { number: item.number }) },
        ]}
      />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <Link href={item.inventory.href} className="hover:underline">
              {t("tree.up")}: {t("tree.inventoryOf", { number: item.inventory.number })}
            </Link>
          </p>
          <h1 className="text-3xl font-bold" lang={item.title_lang}>
            {item.title || t("tree.caseOf", { number: item.number })}
            {item.is_demo && <DemoBadge className="ml-3 align-middle" />}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[
              item.dates_text,
              item.sheets_count ? t("tree.sheetsCount", { count: item.sheets_count }) : null,
              t("tree.counts.documents", { count: item.document_count }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </header>
        <h2 className="text-xl font-semibold">{t("tree.documentsInCase")}</h2>
        <ListSearch path={path} params={query} />
        {item.documents.items.length === 0 ? (
          <p className="text-muted-foreground">{t("tree.emptyDocuments")}</p>
        ) : (
          <ul className="space-y-3">
            {item.documents.items.map((doc) => (
              <li key={doc.id}><DocumentCard item={doc} /></li>
            ))}
          </ul>
        )}
        <Pagination pathname={path} params={query} page={item.documents.page} pages={item.documents.pages} />
      </div>
    </>
  );
}
