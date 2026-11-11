import { ImageOff } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FavoriteButton } from "@/components/cabinet/favorite-button";
import { fetchPublic, type ExhibitionDetail } from "@/components/exhibitions/api";
import { ThemeLabel } from "@/components/exhibitions/theme-label";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ShareButtons } from "@/components/layout/share-buttons";
import { SimilarMaterials } from "@/components/recommendations/similar-materials";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { NotFoundState, UnavailableState } from "@/components/ui/state-view";
import { fileUrl } from "@/lib/api/document";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

async function load(slug: string, locale: string): Promise<ExhibitionDetail | null | undefined> {
  try {
    return await fetchPublic<ExhibitionDetail>(`exhibitions/${encodeURIComponent(slug)}`, new URLSearchParams(), locale);
  } catch {
    return undefined; // backend недоступен
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const exhibition = await load(slug, locale);
  return { title: exhibition?.title, alternates: localizedAlternates(locale, `/exhibitions/${slug}`) };
}

export default async function ExhibitionPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("exhibitions");
  const exhibition = await load(slug, locale);
  if (exhibition === undefined) return <UnavailableState />;
  if (exhibition === null) return <NotFoundState />;

  return (
    <>
      <Breadcrumbs items={[{ label: t("title"), href: "/exhibitions" }, { label: exhibition.title }]} />
      <div className="container-page space-y-8 pb-12">
        <header className="space-y-3">
          <h1 className="break-words text-3xl font-bold" lang={exhibition.title_lang}>
            {exhibition.title}
          </h1>
          <p className="flex flex-wrap items-center gap-3 text-muted-foreground">
            {exhibition.theme && <ThemeLabel theme={exhibition.theme} />}
            {exhibition.period && <span>{exhibition.period}</span>}
            {exhibition.title_lang !== locale && <DemoBadge kind="noTranslation" />}
          </p>
          <p className="max-w-3xl whitespace-pre-line" lang={exhibition.title_lang}>{exhibition.intro}</p>
          <div className="flex flex-wrap items-center gap-4">
            <ShareButtons title={exhibition.title} />
            <FavoriteButton type="exhibition" id={exhibition.id} />
          </div>
          {exhibition.exhibits.length > 0 && (
            <Button asChild>
              <Link href={`/exhibitions/${exhibition.slug}/1`}>{t("detail.start")}</Link>
            </Button>
          )}
        </header>

        <section aria-labelledby="exhibits-title" className="space-y-4">
          <h2 id="exhibits-title" className="text-xl font-semibold">{t("detail.exhibitsTitle")}</h2>
          {exhibition.exhibits.length === 0 ? (
            <p className="text-muted-foreground">{t("detail.empty")}</p>
          ) : (
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {exhibition.exhibits.map((exhibit) => {
                const thumb = exhibit.media?.preview_url ?? exhibit.media?.url;
                return (
                  <li key={exhibit.id} className="overflow-hidden rounded-lg border bg-surface">
                    <Link href={`/exhibitions/${exhibition.slug}/${exhibit.position}`} className="block hover:bg-surface-muted">
                      <div className="flex aspect-[4/3] items-center justify-center bg-surface-muted text-muted-foreground">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
                          <img src={fileUrl(thumb)} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <ImageOff className="size-6" aria-label={t("detail.noImage")} />
                        )}
                      </div>
                      <p className="p-3 text-sm font-medium">
                        <span className="text-muted-foreground">{exhibit.position}. </span>
                        {exhibit.title}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <SimilarMaterials type="exhibition" id={exhibition.id} types={["exhibition", "collection", "document"]} />
      </div>
    </>
  );
}
