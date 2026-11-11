import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FavoriteButton } from "@/components/cabinet/favorite-button";
import { fetchExhibition, thumbPath } from "@/components/exhibitions/api";
import { MediaImage } from "@/components/exhibitions/media-image";
import { ShareButtons } from "@/components/layout/share-buttons";
import { themeLabel } from "@/components/memory/labels";
import { SimilarMaterials } from "@/components/recommendations/similar-materials";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { DemoTag } from "@/components/ui/demo-tag";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableState } from "@/components/ui/state-view";
import { fileUrl } from "@/lib/api/document";
import { attempt } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const exhibition = await attempt(fetchExhibition(slug, locale));
  return { title: exhibition?.title, description: exhibition?.intro || undefined, alternates: localizedAlternates(locale, `/exhibitions/${slug}`) };
}

export default async function ExhibitionPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const exhibition = await attempt(fetchExhibition(slug, locale));
  if (exhibition === undefined) return <UnavailableState />;
  if (exhibition === null) notFound();
  const t = await getTranslations("exhibitions");
  const base = `/exhibitions/${exhibition.slug}`;
  // В шапке обложка крупная: берём сам файл, если это изображение, иначе его превью.
  const cover = exhibition.cover?.mime.startsWith("image/") ? exhibition.cover.url : thumbPath(exhibition.cover);

  return (
    <>
      <PageHeader
        tone="brand"
        crumbs={[{ label: t("title"), href: "/exhibitions" }, { label: exhibition.title }]}
        title={exhibition.title}
        titleLang={exhibition.title_lang}
        meta={
          <>
            <p className="mr-2 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
              {exhibition.theme && <span>{themeLabel(t, "themes", exhibition.theme)}</span>}
              {exhibition.period && <span>{exhibition.period}</span>}
              <span>{t("card.exhibits", { count: exhibition.exhibits.length })}</span>
            </p>
            {exhibition.is_demo && <DemoTag />}
            {exhibition.title_lang !== locale && <DemoBadge kind="noTranslation" />}
          </>
        }
        lead={exhibition.intro && <p className="whitespace-pre-line" lang={exhibition.title_lang}>{exhibition.intro}</p>}
        actions={exhibition.exhibits.length > 0 && (
          // В баннере токены переназначены: основная кнопка набора здесь белая.
          <Button asChild size="lg"><Link href={`${base}/${exhibition.exhibits[0].position}`}>{t("detail.start")}</Link></Button>
        )}
        aside={cover && <MediaImage src={fileUrl(cover)} alt="" fallback={t("card.noCover")} eager className="aspect-[4/3] rounded-2xl" />}
      />

      <div className="container-page space-y-10 py-4 pb-16">
        <div className="flex flex-wrap items-center gap-4" data-noprint>
          <ShareButtons title={exhibition.title} />
          <FavoriteButton type="exhibition" id={exhibition.id} />
        </div>
        {exhibition.translation_status === "machine" && <Notice className="max-w-3xl">{t("detail.machine")}</Notice>}

        <section aria-labelledby="exhibits" className="space-y-6">
          <div className="max-w-2xl">
            <h2 id="exhibits" className="text-2xl">{t("detail.exhibitsTitle")}</h2>
            {exhibition.exhibits.length > 0 && <p className="mt-2 text-muted-foreground">{t("detail.exhibitsText")}</p>}
          </div>
          {exhibition.exhibits.length === 0 ? (
            <p className="card max-w-2xl p-6 text-muted-foreground">
              {t("detail.empty")} <Link href="/exhibitions" className="text-link">{t("detail.others")}</Link>
            </p>
          ) : (
            <ol className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {exhibition.exhibits.map((exhibit) => {
                const thumb = thumbPath(exhibit.media);
                return (
                  // min-w-0 и break-words: длинное слово в названии не раздвигает колонку на узком экране.
                  <li key={exhibit.id} className="min-w-0">
                    <article className="card lift group relative flex h-full flex-col overflow-hidden">
                      <MediaImage src={thumb && fileUrl(thumb)} alt="" fallback={t(exhibit.video_url ? "detail.video" : "detail.noImage")} className="aspect-[4/3] rounded-none border-0" />
                      <div className="space-y-1 p-4">
                        <h3 className="flex gap-2 text-base leading-snug">
                          <span className="tabular-nums text-primary">{exhibit.position}.</span>
                          {/* Ссылка растянута на всю карточку: изображение тоже нажимается. */}
                          <Link href={`${base}/${exhibit.position}`} className="min-w-0 break-words after:absolute after:inset-0 group-hover:text-primary">{exhibit.title}</Link>
                        </h3>
                        {exhibit.caption && <p className="line-clamp-2 text-sm text-muted-foreground">{exhibit.caption}</p>}
                        {exhibit.is_demo && <p className="pt-1"><DemoTag /></p>}
                      </div>
                    </article>
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
