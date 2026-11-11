import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FavoriteButton } from "@/components/cabinet/favorite-button";
import { fetchPublic } from "@/components/exhibitions/api";
import { ShareButtons } from "@/components/layout/share-buttons";
import { safe } from "@/components/misc/api";
import { RichText } from "@/components/misc/rich-text";
import { Unavailable } from "@/components/misc/state-help";
import type { NewsDetail } from "@/components/news/api";
import { SimilarMaterials } from "@/components/recommendations/similar-materials";
import { DemoBadge } from "@/components/ui/demo-badge";
import { DemoTag } from "@/components/ui/demo-tag";
import { ExternalLink } from "@/components/ui/external-link";
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

/** Новость: заголовок, дата и категория, обложка, текст для чтения, медиа и связанные материалы. */
export default async function NewsItemPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("news");
  const item = await load(slug, locale).catch(() => undefined);
  if (item === undefined) return <Unavailable />;
  if (!item) notFound();
  const date = formatIsoDate(item.published_at, locale);
  const heading = "text-2xl";

  return (
    <article>
      <PageHeader
        crumbs={[{ label: t("title"), href: "/news" }, { label: item.title }]}
        title={item.title}
        titleLang={item.title_lang}
        lead={item.summary ? <span lang={item.title_lang}>{item.summary}</span> : undefined}
        meta={
          <>
            <span className="text-sm text-muted-foreground">{date ? <time dateTime={item.published_at ?? undefined}>{date}</time> : t("noDate")}</span>
            {item.category && <span className="text-sm text-muted-foreground">{t.has(`categories.${item.category}`) ? t(`categories.${item.category}`) : item.category}</span>}
            {item.is_demo && <DemoTag />}
            {item.body_lang !== locale && <DemoBadge kind="noTranslation" />}
          </>
        }
        actions={
          <>
            <ShareButtons title={item.title} />
            <FavoriteButton type="news" id={item.id} />
          </>
        }
      />
      <div className="container-page space-y-12 py-10 pb-16">
        {item.cover && (
          // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
          <img src={fileUrl(item.cover.url)} alt="" className="max-h-[28rem] w-full max-w-3xl rounded-md object-cover" />
        )}
        <RichText html={item.body} lang={item.body_lang} />

        {item.media.length > 0 && (
          <section aria-labelledby="news-media" className="space-y-4">
            <h2 id="news-media" className={heading}>{t("detail.media")}</h2>
            <ul className="grid max-w-5xl gap-4 sm:grid-cols-2">
              {item.media.map((entry, index) => (
                <li key={index}>
                  {entry.file ? (
                    // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
                    <img src={fileUrl(entry.file.preview_url ?? entry.file.url)} alt="" loading="lazy" className="w-full rounded-md border" />
                  ) : (
                    entry.url && <ExternalLink href={entry.url} className="text-primary underline underline-offset-[3px]">{t("detail.externalVideo")}</ExternalLink>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {item.related.length > 0 && (
          <section aria-labelledby="news-related" className="max-w-3xl space-y-4">
            <h2 id="news-related" className={heading}>{t("detail.related")}</h2>
            <ul className="card divide-y px-5">
              {item.related.map((related) => (
                <li key={`${related.type}-${related.id}`} className="grid gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[1fr_auto]">
                  <Link href={related.href} className="font-medium hover:text-primary hover:underline">{related.title}</Link>
                  <span className="text-sm text-muted-foreground">{t(`detail.relatedTypes.${related.type}`)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="max-w-5xl">
          <SimilarMaterials type="news" id={item.id} types={["news", "exhibition", "document"]} />
        </div>
        <p><Link href="/news" className="text-link font-medium">{t("detail.back")}</Link></p>
      </div>
    </article>
  );
}
