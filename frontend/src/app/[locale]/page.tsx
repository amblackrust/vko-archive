import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExhibitionCard } from "@/components/exhibitions/exhibition-card";
import { fetchPublic, type ExhibitionList } from "@/components/exhibitions/api";
import { CatalogShowcase, pickFeatured } from "@/components/home/catalog-showcase";
import { Hero } from "@/components/home/hero";
import { SectionTiles } from "@/components/home/section-tiles";
import { TodayInHistory } from "@/components/home/today-in-history";
import { socialEntries } from "@/components/layout/social-data";
import { BranchMap } from "@/components/map/branch-map-loader";
import { formatPublished, type NewsList } from "@/components/news/api";
import { GovServiceCard, SocialCard } from "@/components/ui/brand";
import { LinkTile } from "@/components/ui/link-tile";
import { Section } from "@/components/ui/section";
import { fetchBranches, type Branch } from "@/lib/api/branches";
import { catalogFetch, type DocumentsResponse, type FundItem, type List } from "@/lib/api/catalog";
import { fetchMemorialDates } from "@/lib/api/home";
import { fileUrl } from "@/lib/api/document";
import { fetchSiteSettings } from "@/lib/api/site-settings";
import { Link } from "@/lib/i18n/navigation";

export const dynamic = "force-dynamic";

// Один упавший блок не должен ронять главную: поиск и навигация остаются.
async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

const startLinks = [
  { id: "fund", href: "/navigator" },
  { id: "certificate", href: "/services/state" },
  { id: "exhibitions", href: "/exhibitions" },
  { id: "branch", href: "/branches" },
] as const;

const PORTALS = ["egov", "eotinish", "adilet", "govkz"] as const;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const c = await getTranslations("catalog.categories");
  const one = new URLSearchParams({ per_page: "1" });
  const [catalog, withImages, funds, inventories, cases, branches, memorial, exhibitions, news, settings] = await Promise.all([
    safe(catalogFetch<DocumentsResponse>("documents", one, locale)),
    safe(catalogFetch<DocumentsResponse>("documents", new URLSearchParams({ per_page: "60", has_digital_copy: "true" }), locale)),
    safe(catalogFetch<List<FundItem>>("funds", one, locale)),
    safe(catalogFetch<List<unknown>>("inventories", one, locale)),
    safe(catalogFetch<List<unknown>>("cases", one, locale)),
    safe<Branch[]>(fetchBranches(locale)),
    fetchMemorialDates(locale),
    safe(fetchPublic<ExhibitionList>("exhibitions", new URLSearchParams(), locale)),
    safe(fetchPublic<NewsList>("news", new URLSearchParams({ per_page: "4" }), locale)),
    fetchSiteSettings(locale),
  ]);
  const branchCount = branches?.filter((b) => b.type !== "head").length ?? null;

  return (
    <div className="space-y-2 pb-6">
      <Hero funds={funds?.total ?? null} branches={branchCount} />

      <section aria-labelledby="home-start" className="container-page pt-4">
        <h2 id="home-start" className="sr-only">{t("start.title")}</h2>
        <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {startLinks.map(({ id, href }) => (
            <li key={id}><LinkTile href={href} title={t(`start.${id}.title`)} text={t(`start.${id}.text`)} /></li>
          ))}
        </ul>
      </section>

      <Section id="home-sections" title={t("tiles.title")}>
        <SectionTiles />
      </Section>

      {memorial && settings?.widgets.calendar_weather !== false && <TodayInHistory dates={memorial} locale={locale} />}

      {catalog && (
        <CatalogShowcase
          counts={{ funds: funds?.total ?? null, inventories: inventories?.total ?? null, cases: cases?.total ?? null, documents: catalog.total }}
          categories={catalog.facets.category.map(({ value, count }) => ({ value, count, label: c(value) }))}
          featured={pickFeatured(withImages?.items ?? [])}
        />
      )}

      {exhibitions && exhibitions.items.length > 0 && (
        <Section id="home-exhibitions" title={t("exhibitions.title")} text={t("exhibitions.text")} href="/exhibitions" linkLabel={t("exhibitions.all")}>
          <ul className="grid gap-6 md:grid-cols-3">
            {exhibitions.items.slice(0, 3).map((item) => (
              <li key={item.id}><ExhibitionCard exhibition={item} heading="h3" /></li>
            ))}
          </ul>
        </Section>
      )}

      {branches && branches.length > 0 && (
        <Section id="home-branches" title={t("branches.title")} text={t("branches.text", { count: branches.length })} href="/branches" linkLabel={t("branches.all")}>
          <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
            <div className="card h-80 overflow-hidden lg:h-[26rem]">
              <BranchMap branches={branches} label={t("branches.mapLabel")} tileErrorText={t("branches.tilesFailed")} />
            </div>
            <ul className="card divide-y overflow-y-auto lg:max-h-[26rem]">
              {branches.map((b) => (
                <li key={b.slug}>
                  <Link href={b.href} className="group block px-5 py-3 hover:bg-surface-muted">
                    <span className="block text-[0.9375rem] font-semibold group-hover:text-primary">{b.name}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{b.address}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {news && news.items.length > 0 && (
        <Section id="home-news" title={t("news.title")} href="/news" linkLabel={t("news.all")}>
          <ul className="grid auto-rows-fr gap-5 md:grid-cols-3">
            {news.items.slice(0, 3).map((item) => (
              <li key={item.id} className="card lift group relative flex flex-col overflow-hidden">
                {item.cover?.preview_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
                  <img src={fileUrl(item.cover.preview_url)} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
                )}
                <div className="flex flex-1 flex-col p-5">
                  <time dateTime={item.published_at ?? undefined} className="text-sm text-muted-foreground">{formatPublished(item.published_at, locale)}</time>
                  <h3 className="mt-1.5 text-[1.0625rem] font-semibold leading-snug" lang={item.title_lang}>
                    <Link href={`/news/${item.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">{item.title}</Link>
                  </h3>
                  <p className="mt-2 line-clamp-3 text-[0.9375rem] text-muted-foreground" lang={item.title_lang}>{item.summary}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="home-portals" title={t("portals.title")} text={t("portals.text")}>
        <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2">
          {PORTALS.map((id) => <li key={id}><GovServiceCard id={id} /></li>)}
        </ul>
        <h3 className="mt-10 text-xl">{t("social.title")}</h3>
        <ul className="mt-4 grid auto-rows-fr gap-4 sm:grid-cols-2">
          {socialEntries(settings?.social).map(([network, link]) => (
            <li key={network}>
              <SocialCard network={network} name={network.charAt(0).toUpperCase() + network.slice(1)} handle={link.handle ?? link.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} href={link.url} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
