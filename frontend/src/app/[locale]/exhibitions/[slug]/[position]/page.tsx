import { ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchExhibition, thumbPath } from "@/components/exhibitions/api";
import { ExhibitViewer } from "@/components/exhibitions/exhibit-viewer";
import { ShareButtons } from "@/components/layout/share-buttons";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
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

/** Просмотр экспоната: изображение с увеличением и листанием, рядом подпись, источник и шифр, ниже — лента всех экспонатов. */
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
  const facts = [
    { label: t("exhibit.source"), value: exhibit.source },
    { label: t("exhibit.code"), value: exhibit.archive_code && <span className="cipher">{exhibit.archive_code}</span> },
    { label: t("exhibit.video"), value: exhibit.video_url && <ExternalLink href={exhibit.video_url} className="text-link">{new URL(exhibit.video_url).hostname}</ExternalLink> },
  ].filter((fact) => fact.value);

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("title"), href: "/exhibitions" }, { label: exhibition.title, href: base }, { label: t("exhibit.crumb", { n: index + 1 }) }]}
        title={exhibit.title}
        lead={<p className="tabular-nums">{t("exhibit.counter", { n: index + 1, total: exhibits.length })}</p>}
      />
      <div className="container-page space-y-12 pb-16">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            <ExhibitViewer
              key={exhibit.id}
              src={image ? fileUrl(image) : null}
              alt={exhibit.title}
              prevHref={prevHref}
              nextHref={nextHref}
              nav={
                // scroll={false}: при листании страница не прыгает к началу, следующий экспонат появляется на месте прежнего.
                <nav aria-label={t("exhibit.nav")} className="flex gap-2 max-sm:w-full max-sm:*:flex-1 sm:ml-auto">
                  {prevHref && (
                    <Button asChild variant="outline">
                      <Link href={prevHref} rel="prev" scroll={false}><ChevronLeft aria-hidden />{t("exhibit.prev")}</Link>
                    </Button>
                  )}
                  {nextHref ? (
                    <Button asChild>
                      <Link href={nextHref} rel="next" scroll={false}>{t("exhibit.next")}<ChevronRight aria-hidden /></Link>
                    </Button>
                  ) : (
                    <Button asChild><Link href={base}>{t("exhibit.back")}</Link></Button>
                  )}
                </nav>
              }
            >
              <p>{t(exhibit.video_url ? "exhibit.videoOnly" : "detail.noImage")}</p>
            </ExhibitViewer>
          </div>

          {/* Источник указывается прямо у экспоната: подпись, происхождение и шифр — одной карточкой. */}
          <aside className="space-y-4 lg:sticky lg:top-28">
            <div className="card divide-y px-6">
              {exhibit.caption && (
                <section aria-labelledby="exhibit-caption" className="py-5">
                  <h2 id="exhibit-caption" className="text-sm font-normal text-muted-foreground">{t("exhibit.caption")}</h2>
                  <p className="reading mt-1 whitespace-pre-line">{exhibit.caption}</p>
                </section>
              )}
              {facts.length > 0 && (
                <dl className="space-y-3 py-5">
                  {facts.map((fact) => (
                    <div key={fact.label}>
                      <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                      <dd className="mt-0.5 min-w-0 break-words text-[0.9375rem]">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {exhibit.document_href && (
                <div className="py-5">
                  <Button asChild className="w-full"><Link href={exhibit.document_href}>{t("exhibit.toDocument")}</Link></Button>
                </div>
              )}
            </div>
            <ShareButtons title={exhibit.title} />
          </aside>
        </div>

        <section aria-labelledby="exhibit-all" data-noprint>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
            <h2 id="exhibit-all" className="text-2xl sm:text-3xl">{t("exhibit.all")}</h2>
            <Link href={base} className="text-link font-semibold">{t("exhibit.back")}</Link>
          </div>
          {/* Лента: на телефоне листается вбок; на широком экране до двенадцати экспонатов встают в один ряд. */}
          <ol
            style={{ "--n": exhibits.length } as React.CSSProperties}
            className={cn(
              "-mx-1 mt-5 grid grid-flow-col auto-cols-[5.5rem] gap-3 overflow-x-auto p-1 sm:auto-cols-[6.5rem]",
              exhibits.length <= 12 && "lg:grid-flow-row lg:grid-cols-[repeat(var(--n),minmax(0,7.5rem))] lg:overflow-visible",
            )}
          >
            {exhibits.map((item, i) => {
              const thumb = thumbPath(item.media);
              return (
                <li key={item.id} className="min-w-0">
                  <Link href={`${base}/${item.position}`} aria-current={i === index ? "page" : undefined} className="group relative block">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
                      <img src={fileUrl(thumb)} alt="" loading="lazy" decoding="async" className={cn("aspect-square w-full rounded-md bg-surface-muted object-cover", i === index ? "outline-2 outline-offset-2 outline-primary" : "group-hover:opacity-85")} />
                    ) : (
                      <span className={cn("block aspect-square rounded-md bg-primary-soft", i === index && "outline-2 outline-offset-2 outline-primary")} />
                    )}
                    <span className={cn("mt-1.5 block text-center text-sm tabular-nums text-muted-foreground", i === index && "font-bold text-foreground")}>{i + 1}</span>
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
