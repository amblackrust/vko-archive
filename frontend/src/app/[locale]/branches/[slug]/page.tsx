import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BranchFacts } from "@/components/map/branch-facts";
import { BranchMap } from "@/components/map/branch-map-loader";
import { RoutePanel } from "@/components/map/route-panel";
import { safe } from "@/components/misc/api";
import { Block } from "@/components/misc/page-layout";
import { Unavailable } from "@/components/misc/state-help";
import { DemoBadge } from "@/components/ui/demo-badge";
import { LinkList } from "@/components/ui/link-list";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { fetchBranch } from "@/lib/api/branches";
import { catalogFetch, type DocumentsResponse } from "@/lib/api/catalog";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const branch = await safe(fetchBranch(slug, locale));
  return { title: branch?.name, description: branch?.address, alternates: localizedAlternates(locale, `/branches/${slug}`) };
}

/** Страница подразделения: контакты, маршрут, небольшая карта и переход к его материалам в каталоге. */
export default async function BranchPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("map");
  const branch = await fetchBranch(slug, locale).catch(() => undefined);
  if (branch === undefined) return <Unavailable />;
  if (!branch) notFound();
  const point = branch.show_on_map && branch.lat != null && branch.lng != null ? { lat: branch.lat, lng: branch.lng } : null;
  // В ответе API филиала нет его идентификатора, поэтому раздел каталога находим по названию в фасете «филиал».
  const catalog = await safe(catalogFetch<DocumentsResponse>("documents", new URLSearchParams({ per_page: "1" }), locale));
  const holdings = catalog?.facets.branch.find((facet) => facet.label === branch.name);

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("title"), href: "/branches" }, { label: branch.name }]}
        title={branch.name}
        titleLang={branch.name_lang}
        lead={branch.description ? <span lang={branch.name_lang}>{branch.description}</span> : undefined}
        meta={
          <>
            <span className="text-sm text-muted-foreground">{t(`types.${branch.type}`)}</span>
            {branch.name_lang !== locale && <DemoBadge kind="noTranslation" />}
          </>
        }
      />
      <div className="container-page grid gap-12 py-10 pb-16 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-12">
          <Block id="contacts" title={t("page.contacts")}>
            <BranchFacts branch={branch} />
          </Block>
          <RoutePanel address={branch.address} point={point} verified={branch.coords_verified} />
          <Block id="funds" title={t("page.funds")}>
            {holdings ? (
              <LinkList items={[{ href: `/catalog?branch_id=${holdings.value}`, label: t("page.documents", { count: holdings.count }) }]} />
            ) : (
              <p className="max-w-3xl text-muted-foreground">{t("page.noHoldings")}</p>
            )}
            <p className="max-w-3xl">
              {t("page.fundsHint")}{" "}
              <Link href="/catalog/funds" className="text-link">{t("page.fundsLink")}</Link>
            </p>
          </Block>
        </div>
        <aside className="space-y-4 self-start lg:sticky lg:top-28">
          {point ? (
            <div className="h-80 overflow-hidden rounded-lg border">
              <BranchMap branches={[branch]} selected={branch.slug} label={t("map.label")} tileErrorText={t("map.tilesFailed")} />
            </div>
          ) : (
            <Notice>{t("card.notOnMap")}</Notice>
          )}
          {point && !branch.coords_verified && <p className="text-sm text-muted-foreground">{t("approxNote")}</p>}
          <p><Link href="/branches" className="text-link font-medium">{t("page.all")}</Link></p>
        </aside>
      </div>
    </>
  );
}
