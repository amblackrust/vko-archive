import { ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchExhibition, thumbPath } from "@/components/exhibitions/api";
import { ExhibitViewer } from "@/components/exhibitions/exhibit-viewer";
import { MediaImage } from "@/components/exhibitions/media-image";
import { ShareButtons } from "@/components/layout/share-buttons";
import { Button } from "@/components/ui/button";
import { DemoTag } from "@/components/ui/demo-tag";
import { ExternalLink } from "@/components/ui/external-link";
import { FactList } from "@/components/ui/facts";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableState } from "@/components/ui/state-view";
import { fileUrl } from "@/lib/api/document";
import { attempt } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: string; slug: string; position: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug, position } = await params;
  const exhibition = await attempt(fetchExhibition(slug, locale));
  const exhibit = exhibition?.exhibits.find((item) => String(item.position) === position);
  return {
    title: exhibit && `${exhibit.title}. ${exhibition!.title}`,
    description: exhibit?.caption || undefined,
    alternates: localizedAlternates(locale, `/exhibitions/${slug}/${position}`),
  };
}

/** Просмотр экспоната: изображение с увеличением, подпись и источник рядом с ним, переход к документу и к соседним экспонатам. */
export default async function ExhibitPage({ params }: Props) {
  const { locale, slug, position } = await params;
  setRequestLocale(locale);
  const exhibition = await attempt(fetchExhibition(slug, locale));
  if (exhibition === undefined) return <UnavailableState />;
  const index = exhibition?.exhibits.findIndex((item) => String(item.position) === position) ?? -1;
  if (!exhibition || index < 0) notFound();
  const t = await getTranslations("exhibitions");
  const exhibits = exhibition.exhibits;
  const exhibit = exhibits[index];
  const base = `/exhibitions/${exhibition.slug}`;
  const hrefOf = (item?: { position: number }) => item && `${base}/${item.position}`;
  const [prevHref, nextHref] = [hrefOf(exhibits[index - 1]), hrefOf(exhibits[index + 1])];
  // В рамке показывается изображение; у файла другого вида (например, PDF) — его превью.
  const image = exhibit.media && (exhibit.media.mime.startsWith("image/") ? exhibit.media.url : exhibit.media.preview_url);

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("title"), href: "/exhibitions" }, { label: exhibition.title, href: base }, { label: t("exhibit.crumb", { n: index + 1 }) }]}
        title={exhibit.title}
        meta={
          <>
            <p className="mr-2 text-sm font-semibold tabular-nums text-muted-foreground">{t("exhibit.counter", { n: index + 1, total: exhibits.length })}</p>
            {exhibit.is_demo && <DemoTag />}
          </>
        }
      />
      <div className="container-page space-y-10 py-4 pb-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            <ExhibitViewer key={exhibit.id} src={image ? fileUrl(image) : null} alt={exhibit.title} prevHref={prevHref} nextHref={nextHref}>
              <p>{t(exhibit.video_url ? "exhibit.videoOnly" : "detail.noImage")}</p>
            </ExhibitViewer>
            {/* scroll={false}: при листании страница не прыгает к началу, следующий экспонат появляется на месте прежнего. */}
            <nav aria-label={t("exhibit.nav")} className="flex flex-wrap items-center justify-between gap-3" data-noprint>
              {prevHref ? (
                <Button asChild variant="outline">
                  <Link href={prevHref} rel="prev" scroll={false}><ChevronLeft aria-hidden />{t("exhibit.prev")}</Link>
                </Button>
              ) : <span />}
              {nextHref ? (
                <Button asChild>
                  <Link href={nextHref} rel="next" scroll={false}>{t("exhibit.next")}<ChevronRight aria-hidden /></Link>
                </Button>
              ) : (
                <Button asChild variant="outline"><Link href={base}>{t("exhibit.back")}</Link></Button>
              )}
            </nav>
          </div>

          <aside className="space-y-4">
            {exhibit.caption && (
              <section aria-labelledby="exhibit-caption" className="card space-y-2 p-5">
                <h2 id="exhibit-caption" className="text-base">{t("exhibit.caption")}</h2>
                <p className="reading whitespace-pre-line">{exhibit.caption}</p>
              </section>
            )}
            {/* Требование заказчика: источник указывается прямо в карточке экспоната. */}
            <FactList
              items={[
                { label: t("exhibit.source"), value: exhibit.source },
                { label: t("exhibit.code"), value: exhibit.archive_code && <span className="cipher">{exhibit.archive_code}</span> },
                { label: t("exhibit.video"), value: exhibit.video_url && <ExternalLink href={exhibit.video_url} className="text-link">{new URL(exhibit.video_url).hostname}</ExternalLink> },
              ]}
            />
            {exhibit.document_href && (
              <Button asChild className="w-full"><Link href={exhibit.document_href}>{t("exhibit.toDocument")}</Link></Button>
            )}
            <ShareButtons title={exhibit.title} />
          </aside>
        </div>

        <section aria-labelledby="exhibit-all" className="space-y-4" data-noprint>
          <h2 id="exhibit-all" className="text-2xl">{t("exhibit.all")}</h2>
          <ol className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {exhibits.map((item, i) => {
              const thumb = thumbPath(item.media);
              return (
                <li key={item.id}>
                  <Link href={`${base}/${item.position}`} aria-current={i === index ? "page" : undefined} className="group block">
                    <MediaImage src={thumb && fileUrl(thumb)} alt="" fallback="" className={cn("aspect-square rounded-md group-hover:border-primary", i === index && "border-2 border-primary")} />
                    <span className={cn("mt-1 block text-center text-sm tabular-nums text-muted-foreground", i === index && "font-bold text-foreground")}>{i + 1}</span>
                    <span className="sr-only">{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </>
  );
}
