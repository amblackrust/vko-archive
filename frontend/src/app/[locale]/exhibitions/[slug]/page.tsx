import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FavoriteButton } from "@/components/cabinet/favorite-button";
import { fetchExhibition, thumbPath } from "@/components/exhibitions/api";
import { ShareButtons } from "@/components/layout/share-buttons";
import { evenGrid, TILE_COLS } from "@/components/memory/grid";
import { themeLabel } from "@/components/memory/labels";
import { SimilarMaterials } from "@/components/recommendations/similar-materials";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { LinkTile } from "@/components/ui/link-tile";
import { Notice } from "@/components/ui/notice";
import { UnavailableState } from "@/components/ui/state-view";
import { fileUrl } from "@/lib/api/document";
import { attempt } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: string; slug: string }> };

/** Экспонаты и на телефоне идут в две колонки: их много, а плитка — изображение с короткой подписью. */
const COLS: Record<number, string> = { ...TILE_COLS, 5: "grid-cols-2 xl:grid-cols-5" };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const exhibition = await attempt(fetchExhibition(slug, locale));
  return { title: exhibition?.title, description: exhibition?.intro || undefined, alternates: localizedAlternates(locale, `/exhibitions/${slug}`) };
}

/** Выставка: обложка и вступление одной карточкой, ниже — экспонаты равной сеткой в порядке составителя. */
export default async function ExhibitionPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const exhibition = await attempt(fetchExhibition(slug, locale));
  if (exhibition === undefined) return <UnavailableState />;
  if (exhibition === null) notFound();
  const t = await getTranslations("exhibitions");
  const base = `/exhibitions/${exhibition.slug}`;
  const exhibits = exhibition.exhibits;
  // Обложка крупная: берём сам файл, если это изображение, иначе его превью.
  const cover = exhibition.cover?.mime.startsWith("image/") ? exhibition.cover.url : thumbPath(exhibition.cover);
  // Обложкой служит изображение одного из экспонатов: его происхождение подписано под обложкой.
  const coverExhibit = exhibition.cover && exhibits.find((item) => item.media?.url === exhibition.cover!.url);
  const grid = evenGrid(exhibits.length, [4, 5, 3]);

  return (
    <>
      <Breadcrumbs items={[{ label: t("title"), href: "/exhibitions" }, { label: exhibition.title }]} />
      <div className="container-page space-y-12 pb-16">
        {/* Не <header>: внутри кнопки «Поделиться» и «В избранное», а шапка сайта ищется по header. */}
        <div className={cn("card grid overflow-hidden rounded-3xl", cover && "lg:grid-cols-2")}>
          {cover && (
            <figure className="relative min-h-64 sm:min-h-80 lg:min-h-[28rem]">
              {/* eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав */}
              <img src={fileUrl(cover)} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover" />
              {coverExhibit?.source && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#152040]/85 to-transparent px-5 pb-3 pt-10 text-xs text-white">{coverExhibit.source}</figcaption>
              )}
            </figure>
          )}
          <div className="flex flex-col justify-center gap-5 p-6 sm:p-10">
            <h1 className="break-words text-3xl sm:text-4xl" lang={exhibition.title_lang}>{exhibition.title}</h1>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {exhibition.theme && <span>{themeLabel(t, "themes", exhibition.theme)}</span>}
              {exhibition.period && <span className="tabular-nums">{exhibition.period}</span>}
              <span className="tabular-nums">{t("card.exhibits", { count: exhibits.length })}</span>
            </p>
            {exhibition.intro && <p className="whitespace-pre-line text-muted-foreground" lang={exhibition.title_lang}>{exhibition.intro}</p>}
            {exhibition.translation_status === "machine" && <Notice>{t("detail.machine")}</Notice>}
            <div className="flex flex-wrap items-center gap-3 pt-1" data-noprint>
              {exhibits.length > 0 && (
                <Button asChild size="lg"><Link href={`${base}/${exhibits[0].position}`}>{t("detail.start")}</Link></Button>
              )}
              <ShareButtons title={exhibition.title} />
              <FavoriteButton type="exhibition" id={exhibition.id} />
            </div>
          </div>
        </div>

        {exhibits.length > 0 && (
          <section aria-labelledby="exhibits">
            <h2 id="exhibits" className="text-2xl sm:text-3xl">{t("detail.exhibitsTitle")}</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">{t("detail.exhibitsText")}</p>
            <ol className={cn("mt-6 grid auto-rows-fr gap-3 sm:gap-4", COLS[grid.cols])}>
              {exhibits.map((exhibit) => {
                const thumb = thumbPath(exhibit.media);
                return (
                  // min-w-0 и break-words: длинное слово в названии не раздвигает колонку на узком экране.
                  <li key={exhibit.id} className="min-w-0">
                    <article className="card lift group relative flex h-full flex-col overflow-hidden">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
                        <img src={fileUrl(thumb)} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full bg-surface-muted object-cover" />
                      ) : (
                        <p className="flex aspect-[4/3] items-center bg-primary-soft p-4 text-sm font-medium text-primary">{t(exhibit.video_url ? "detail.video" : "detail.noImage")}</p>
                      )}
                      <div className="flex flex-1 flex-col p-3 sm:p-4">
                        <h3 className="line-clamp-3 hyphens-auto text-[0.9375rem] font-semibold leading-snug sm:text-base">
                          {/* Ссылка растянута на всю карточку: изображение тоже нажимается. Номер — порядок просмотра. */}
                          <Link href={`${base}/${exhibit.position}`} className="break-words after:absolute after:inset-0 group-hover:text-primary">
                            <span className="tabular-nums text-primary">{exhibit.position}.</span> {exhibit.title}
                          </Link>
                        </h3>
                        {exhibit.caption && <p className="mt-1.5 hidden text-sm text-muted-foreground sm:line-clamp-2">{exhibit.caption}</p>}
                      </div>
                    </article>
                  </li>
                );
              })}
              {grid.closing && <li><LinkTile accent href="/exhibitions" title={t("detail.others")} /></li>}
            </ol>
          </section>
        )}

        <SimilarMaterials type="exhibition" id={exhibition.id} types={["exhibition", "collection", "document"]} />
      </div>
    </>
  );
}
