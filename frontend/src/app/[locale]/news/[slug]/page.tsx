import { ExternalLink } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FavoriteButton } from "@/components/cabinet/favorite-button";
import { fetchPublic } from "@/components/exhibitions/api";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ShareButtons } from "@/components/layout/share-buttons";
import { formatPublished, type NewsDetail } from "@/components/news/api";
import { SimilarMaterials } from "@/components/recommendations/similar-materials";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { NotFoundState, UnavailableState } from "@/components/ui/state-view";
import { fileUrl } from "@/lib/api/document";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

async function load(slug: string, locale: string): Promise<NewsDetail | null | undefined> {
  try {
    return await fetchPublic<NewsDetail>(`news/${encodeURIComponent(slug)}`, new URLSearchParams(), locale);
  } catch {
    return undefined; // backend недоступен
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const item = await load(slug, locale);
  return { title: item?.title, alternates: localizedAlternates(locale, `/news/${slug}`) };
}

export default async function NewsItemPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("news");
  const item = await load(slug, locale);
  if (item === undefined) return <UnavailableState />;
  if (item === null) return <NotFoundState />;
  const date = formatPublished(item.published_at, locale);
  const cover = item.cover?.url;

  return (
    <>
      <Breadcrumbs items={[{ label: t("title"), href: "/news" }, { label: item.title }]} />
      <article className="container-page max-w-4xl space-y-6 pb-12">
        <header className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {date && <time dateTime={item.published_at ?? undefined}>{date}</time>}
            {item.category && <span>{t.has(`categories.${item.category}`) ? t(`categories.${item.category}`) : item.category}</span>}
            {item.body_lang !== locale && <DemoBadge kind="noTranslation" />}
          </p>
          <h1 className="break-words text-3xl font-bold" lang={item.title_lang}>{item.title}</h1>
          <div className="flex flex-wrap items-center gap-4">
            <ShareButtons title={item.title} />
            <FavoriteButton type="news" id={item.id} />
          </div>
        </header>

        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
          <img src={fileUrl(cover)} alt="" className="max-h-96 w-full rounded-lg border object-cover" />
        )}

        <div
          lang={item.body_lang}
          className="space-y-3 break-words [&_a]:text-primary [&_a]:underline [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          // HTML очищен на сервере (backend/app/services/sanitize.py): скрипты, обработчики и javascript: удалены.
          dangerouslySetInnerHTML={{ __html: item.body }}
        />

        {item.media.length > 0 && (
          <section aria-labelledby="news-media" className="space-y-3">
            <h2 id="news-media" className="text-xl font-semibold">{t("detail.media")}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {item.media.map((entry, i) => (
                <li key={i}>
                  {entry.file ? (
                    // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
                    <img src={fileUrl(entry.file.url)} alt="" loading="lazy" className="w-full rounded-lg border" />
                  ) : (
                    entry.url && (
                      <a href={entry.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink className="size-4" aria-hidden /> {t("detail.externalVideo")}
                      </a>
                    )
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {item.related.length > 0 && (
          <section aria-labelledby="news-related" className="space-y-3">
            <h2 id="news-related" className="text-xl font-semibold">{t("detail.related")}</h2>
            <ul className="space-y-2">
              {item.related.map((rel) => (
                <li key={`${rel.type}-${rel.id}`}>
                  <Link href={rel.href} className="text-primary hover:underline">{rel.title}</Link>
                  <span className="ml-2 text-sm text-muted-foreground">{t(`detail.relatedTypes.${rel.type}`)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <SimilarMaterials type="news" id={item.id} types={["news", "exhibition", "document"]} />

        <Button asChild variant="ghost">
          <Link href="/news">{t("detail.back")}</Link>
        </Button>
      </article>
    </>
  );
}
