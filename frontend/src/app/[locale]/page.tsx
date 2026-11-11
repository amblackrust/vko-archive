import { Building2, FileCheck2, GalleryVerticalEnd, MapPin, Newspaper, Info, type LucideIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExhibitionCard } from "@/components/exhibitions/exhibition-card";
import { fetchPublic, type ExhibitionList } from "@/components/exhibitions/api";
import { CatalogShowcase, pickFeatured } from "@/components/home/catalog-showcase";
import { Hero } from "@/components/home/hero";
import { SectionTiles } from "@/components/home/section-tiles";
import { TodayInHistory } from "@/components/home/today-in-history";
import { socialEntries } from "@/components/layout/social-data";
import { SocialLinks } from "@/components/layout/social-links";
import { BranchMap } from "@/components/map/branch-map-loader";
import { formatPublished, type NewsList } from "@/components/news/api";
import { ExternalLink } from "@/components/ui/external-link";
import { Section } from "@/components/ui/section";
import { fetchBranches, type Branch } from "@/lib/api/branches";
import { catalogFetch, type DocumentsResponse, type FundItem, type List } from "@/lib/api/catalog";
import { fetchMemorialDates } from "@/lib/api/home";
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

const startLinks: { id: string; href: string; icon: LucideIcon }[] = [
  { id: "fund", href: "/navigator", icon: Building2 },
  { id: "certificate", href: "/services/state", icon: FileCheck2 },
  { id: "exhibitions", href: "/exhibitions", icon: GalleryVerticalEnd },
  { id: "branch", href: "/branches", icon: MapPin },
];

const usefulLinks = [
  { id: "catalogHowto", href: "/help#search" },
  { id: "structure", href: "/help#structure" },
  { id: "published", href: "/help#materials" },
  { id: "branchesInfo", href: "/branches" },
  { id: "readingRoom", href: "/help/reading-room" },
  { id: "legal", href: "/legal" },
];

/** Круглый значок раздела в карточке. */
function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {startLinks.map(({ id, href, icon }) => (
            <li key={id}>
              <Link href={href} className="card lift group flex h-full flex-col gap-4 p-5">
                <IconBadge icon={icon} />
                <span>
                  <span className="block text-[1.0625rem] font-semibold group-hover:text-primary">{t(`start.${id}.title`)}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{t(`start.${id}.text`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Section id="home-sections" title={t("tiles.title")}>
        <SectionTiles />
      </Section>

      {memorial && <TodayInHistory dates={memorial} locale={locale} />}

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
              <li key={item.id}><ExhibitionCard exhibition={item} locale={locale} heading="h3" /></li>
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

      <section className="container-page grid gap-4 py-10 lg:grid-cols-[1.4fr_1fr] lg:py-14">
        <div aria-labelledby="home-news" role="region" className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="home-news" className="flex items-center gap-3 text-xl">
              <IconBadge icon={Newspaper} />
              {t("news.title")}
            </h2>
            <Link href="/news" className="text-link text-[0.9375rem] font-medium">{t("news.all")}</Link>
          </div>
          {news && news.items.length > 0 ? (
            <ul className="mt-4 divide-y">
              {news.items.map((item) => (
                <li key={item.id}>
                  <Link href={`/news/${item.slug}`} className="group grid gap-1 py-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
                    <time dateTime={item.published_at ?? undefined} className="text-sm text-muted-foreground">
                      {formatPublished(item.published_at, locale)}
                    </time>
                    <span>
                      <span className="block font-semibold group-hover:text-primary" lang={item.title_lang}>{item.title}</span>
                      <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground" lang={item.title_lang}>{item.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-muted-foreground">{t("news.empty")}</p>
          )}
        </div>
        <div aria-labelledby="home-useful" role="region" className="card p-6 sm:p-8">
          <h2 id="home-useful" className="flex items-center gap-3 text-xl">
            <IconBadge icon={Info} />
            {t("useful.title")}
          </h2>
          <ul className="mt-4 space-y-1">
            {usefulLinks.map(({ id, href }) => (
              <li key={id}><Link href={href} className="block rounded-md px-3 py-2 text-[0.9375rem] hover:bg-primary-soft hover:text-primary">{t(`useful.${id}`)}</Link></li>
            ))}
            {(settings?.useful_links.length ? settings.useful_links : [{ title: t("useful.egov"), url: "https://egov.kz" }]).map((link) => (
              <li key={link.url} className="px-3 py-2 text-[0.9375rem]"><ExternalLink href={link.url}>{link.title}</ExternalLink></li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="home-social" className="container-page pb-8">
        <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
          <h2 id="home-social" className="text-base">{t("social.title")}</h2>
          <SocialLinks />
          {socialEntries(settings?.social).map(([network, link]) => (
            <a key={network} href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:text-primary hover:underline">
              {link.handle ?? link.url.replace(/^https?:\/\//, "")}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
