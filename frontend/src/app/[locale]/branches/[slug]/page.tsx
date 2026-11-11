import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BranchTiles } from "@/components/map/branch-facts";
import { BranchMap } from "@/components/map/branch-map-loader";
import { RoutePanel } from "@/components/map/route-panel";
import { safe } from "@/components/misc/api";
import { Unavailable } from "@/components/misc/state-help";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { fetchBranch } from "@/lib/api/branches";
import { catalogFetch, type DocumentsResponse } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const branch = await safe(fetchBranch(slug, locale));
  return { title: branch?.name, description: branch?.address, alternates: localizedAlternates(locale, `/branches/${slug}`) };
}

/** Страница подразделения: крупная карта и контакты плитками, маршрут, а если в каталоге есть его документы — переход к ним. */
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
  const fundsTile = <LinkTile href="/catalog/funds" title={t("page.fundsList")} text={t("page.fundsListText")} />;
  const allTile = <LinkTile href="/branches" title={t("page.all")} text={t("page.allText")} accent />;

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("title"), href: "/branches" }, { label: branch.name }]}
        title={branch.name}
        titleLang={branch.name_lang}
        lead={branch.description ? <span lang={branch.name_lang}>{branch.description}</span> : undefined}
        meta={<span className="text-sm text-muted-foreground">{t(`types.${branch.type}`)}</span>}
      />
      <div className="container-page space-y-14 pb-16 pt-2">
        <section aria-labelledby="contacts-title" className="grid gap-4 lg:grid-cols-12">
          <h2 id="contacts-title" className="sr-only">{t("page.contacts")}</h2>
          <div className="lg:col-span-5">
            <BranchTiles branch={branch}>
              {/* Без документов в каталоге отдельного блока фондов нет: перечень фондов стоит рядом с контактами. */}
              {holdings ? <li className="sm:col-span-2 lg:col-span-1 xl:col-span-2">{allTile}</li> : <><li>{fundsTile}</li><li>{allTile}</li></>}
            </BranchTiles>
          </div>
          {point && (
            <figure className="card order-first flex min-h-80 flex-col overflow-hidden rounded-3xl lg:order-none lg:col-span-7">
              <div className="min-h-72 flex-1">
                <BranchMap branches={[branch]} selected={branch.slug} label={t("map.label")} tileErrorText={t("map.tilesFailed")} />
              </div>
              {!branch.coords_verified && <figcaption className="px-5 py-3 text-sm text-muted-foreground">{t("approxNote")}</figcaption>}
            </figure>
          )}
        </section>

        <RoutePanel address={branch.address} point={point} verified={branch.coords_verified} />

        {(holdings || branch.funds_summary) && (
          <section aria-labelledby="funds-title">
            <h2 id="funds-title" className="text-2xl sm:text-3xl">{t("page.funds")}</h2>
            {branch.funds_summary && <p className="reading mt-4 max-w-[70ch]" lang={branch.name_lang}>{branch.funds_summary}</p>}
            <ul className="mt-6 grid auto-rows-fr gap-4 md:grid-cols-2">
              {holdings && <li><LinkTile href={`/catalog?branch_id=${holdings.value}`} title={t("page.documents", { count: holdings.count })} text={t("page.documentsText")} /></li>}
              <li>{fundsTile}</li>
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
