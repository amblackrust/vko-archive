import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FavoriteButton } from "@/components/cabinet/favorite-button";
import { fetchPublic } from "@/components/exhibitions/api";
import { ShareButtons } from "@/components/layout/share-buttons";
import { safe } from "@/components/misc/api";
import { RichText } from "@/components/misc/rich-text";
import { Unavailable } from "@/components/misc/state-help";
import type { NewsDetail, NewsList } from "@/components/news/api";
import { SimilarMaterials } from "@/components/recommendations/similar-materials";
import { ExternalLink } from "@/components/ui/external-link";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { fileUrl } from "@/lib/api/document";
import { formatIsoDate } from "@/lib/dates";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

const load = (slug: string, locale: string) => fetchPublic<NewsDetail>(`news/${encodeURIComponent(slug)}`, new URLSearchParams(), locale);

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const item = await safe(load(slug, locale));
  return { title: item?.title, description: item?.summary || undefined, alternates: localizedAlternates(locale, `/news/${slug}`) };
}

const OTHER = 4;
const asideTitle = "mb-3 text-[1.0625rem]";

/**
 * Новость: заголовок с датой и категорией, статья одной карточкой (обложка и текст для чтения),
 * справа — связанные материалы и другие новости, ниже — похожие материалы.
 */
export default async function NewsItemPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("news");
  const item = await load(slug, locale).catch(() => undefined);
  if (item === undefined) return <Unavailable />;
  if (!item) notFound();
  const date = formatIsoDate(item.published_at, locale);
  const latest = await safe(fetchPublic<NewsList>("news", new URLSearchParams({ sort: "date_desc", page: "1" }), locale));
  const other = latest?.items.filter((entry) => entry.id !== item.id).slice(0, OTHER) ?? [];

  return (
    <article>
      <PageHeader
        crumbs={[{ label: t("title"), href: "/news" }, { label: item.title }]}
        title={item.title}
        titleLang={item.title_lang}
        lead={item.summary ? <span lang={item.title_lang}>{item.summary}</span> : undefined}
        meta={
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            {item.category && <span className="font-semibold text-primary">{t.has(`categories.${item.category}`) ? t(`categories.${item.category}`) : item.category}</span>}
            {date && <time dateTime={item.published_at ?? undefined} className="text-muted-foreground">{date}</time>}
          </p>
        }
        actions={
          <>
            <ShareButtons title={item.title} />
            <FavoriteButton type="news" id={item.id} />
          </>
        }
      />
      <div className="container-page space-y-14 pb-16 pt-2">
        <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="card min-w-0 self-start overflow-hidden rounded-3xl">
            {item.cover && (
              // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
              <img src={fileUrl(item.cover.url)} alt="" className="max-h-[32rem] w-full object-cover" />
            )}
            <div className="space-y-10 p-6 sm:p-10">
              <RichText html={item.body} lang={item.body_lang} />
              {item.media.length > 0 && (
                <section aria-labelledby="news-media">
                  <h2 id="news-media" className="text-2xl">{t("detail.media")}</h2>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {item.media.map((entry, index) => (
                      <li key={index}>
                        {entry.file ? (
                          // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
                          <img src={fileUrl(entry.file.preview_url ?? entry.file.url)} alt="" loading="lazy" className="w-full rounded-md" />
                        ) : (
                          entry.url && <ExternalLink href={entry.url} className="text-link">{t("detail.externalVideo")}</ExternalLink>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>

          <aside className="space-y-8 self-start lg:sticky lg:top-28">
            {item.related.length > 0 && (
              <section aria-labelledby="news-related">
                <h2 id="news-related" className={asideTitle}>{t("detail.related")}</h2>
                <ul className="grid gap-3">
                  {item.related.map((related) => (
                    <li key={`${related.type}-${related.id}`}>
                      <LinkTile href={related.href} title={related.title} text={t(`detail.relatedTypes.${related.type}`)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {other.length > 0 && (
              <section aria-labelledby="news-other">
                <h2 id="news-other" className={asideTitle}>{t("detail.other")}</h2>
                <ul className="card divide-y overflow-hidden">
                  {other.map((entry) => (
                    <li key={entry.id}>
                      <Link href={`/news/${entry.slug}`} className="group block px-5 py-3.5 transition-colors hover:bg-surface-muted">
                        <span className="block text-sm text-muted-foreground">{formatIsoDate(entry.published_at, locale)}</span>
                        <span className="mt-0.5 block font-semibold leading-snug group-hover:text-primary" lang={entry.title_lang}>{entry.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <LinkTile href="/news" title={t("detail.back")} text={t("detail.backText")} accent />
          </aside>
        </div>

        <SimilarMaterials type="news" id={item.id} types={["news", "exhibition", "document"]} />
      </div>
    </article>
  );
}
