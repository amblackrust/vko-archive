import { getTranslations, setRequestLocale } from "next-intl/server";
import { CategoryTiles } from "@/components/catalog/category-tiles";
import { HeroSearch } from "@/components/home/hero-search";
import { HomeSection } from "@/components/home/home-section";
import { LinkCards, type LinkCard } from "@/components/home/link-cards";
import { SocialLinks, socialUrls } from "@/components/layout/social-links";
import { BranchMap } from "@/components/map/branch-map-loader";
import { DemoBadge } from "@/components/ui/demo-badge";
import { fetchBranches, type Branch } from "@/lib/api/branches";
import { catalogFetch, type DocumentsResponse } from "@/lib/api/catalog";
import { fetchMemorialDates } from "@/lib/api/home";
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

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const [catalog, branches, memorial] = await Promise.all([
    safe(catalogFetch<DocumentsResponse>("documents", new URLSearchParams({ per_page: "1" }), locale)),
    safe<Branch[]>(fetchBranches(locale)),
    fetchMemorialDates(locale),
  ]);

  const sectionCards = (ids: string[], hrefs: Record<string, string>): LinkCard[] =>
    ids.map((id) => ({ id, title: t(`cards.${id}.title`), text: t(`cards.${id}.text`), href: hrefs[id] }));
  const explore = sectionCards(["history", "exhibitions", "news"], {
    history: "/memory", exhibitions: "/exhibitions", news: "/news",
  });
  const useful = [
    ...sectionCards(["help", "readingRoom", "legal"], { help: "/help", readingRoom: "/reading-room", legal: "/legal" }),
    { id: "egov", title: t("cards.egov.title"), text: t("cards.egov.text"), href: "https://egov.kz", external: true },
  ];

  return (
    <>
      <section aria-labelledby="home-title" className="border-b bg-surface-muted">
        <div className="container-page space-y-6 py-10 sm:py-16">
          <div className="max-w-3xl space-y-3">
            <h1 id="home-title" className="text-3xl font-bold sm:text-5xl">{t("hero.title")}</h1>
            <p className="text-lg text-muted-foreground">{t("hero.subtitle")}</p>
          </div>
          <div className="max-w-4xl"><HeroSearch /></div>
        </div>
      </section>

      <div className="container-page space-y-12 py-10">
        {catalog && (
          <HomeSection id="home-catalog" title={t("catalog.title")} href="/catalog">
            <p className="max-w-3xl text-muted-foreground">{t("catalog.text")}</p>
            <CategoryTiles counts={catalog.facets.category} />
          </HomeSection>
        )}

        <HomeSection id="home-explore" title={t("explore.title")}>
          <LinkCards cards={explore} externalLabel={t("external")} />
        </HomeSection>

        <HomeSection id="home-service" title={t("service.title")}>
          <div className="flex flex-col gap-3 rounded-lg border bg-accent-soft p-5 text-accent-soft-foreground sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl">{t("service.text")}</p>
            <Link href="/services/state" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
              {t("service.cta")}
            </Link>
          </div>
        </HomeSection>

        {branches && branches.length > 0 && (
          <HomeSection id="home-branches" title={t("branches.title")} href="/branches">
            <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
              <div className="h-72 overflow-hidden rounded-lg border">
                <BranchMap branches={branches} label={t("branches.mapLabel")} tileErrorText={t("branches.tilesFailed")} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t("branches.text", { count: branches.length })}</p>
                <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 lg:grid-cols-1">
                  {branches.slice(0, 6).map((b) => (
                    <li key={b.slug}><Link href={b.href} className="hover:underline">{b.name}</Link></li>
                  ))}
                </ul>
                <Link href="/branches" className="inline-block text-sm font-medium text-primary hover:underline">{t("branches.all")}</Link>
              </div>
            </div>
          </HomeSection>
        )}

        <HomeSection id="home-calendar" title={t("calendar.title")}>
          {memorial && memorial.items.length > 0 ? (
            <ul className="space-y-2">
              {memorial.items.slice(0, 5).map((item, i) => (
                <li key={i} className={item.is_today ? "rounded-lg border border-primary bg-accent-soft p-3" : "rounded-lg border bg-surface p-3"}>
                  <span className="font-medium">
                    {item.is_today ? t("calendar.today") : item.day ? `${item.day}.${String(item.month).padStart(2, "0")}` : item.date_text}
                  </span>
                  {" — "}{item.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t("calendar.empty")}</p>
          )}
        </HomeSection>

        <HomeSection id="home-useful" title={t("useful.title")}>
          <LinkCards cards={useful} externalLabel={t("external")} />
        </HomeSection>

        <HomeSection id="home-social" title={t("social.title")}>
          <div className="space-y-3 rounded-lg border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-3">
              <SocialLinks />
              <a href={socialUrls.instagram} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">@arhiv_vko</a>
              <a href={socialUrls.facebook} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">facebook.com/vkoarhiv</a>
            </div>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <DemoBadge kind="demoIntegration" /> {t("social.feedStub")}
            </p>
          </div>
        </HomeSection>
      </div>
    </>
  );
}
