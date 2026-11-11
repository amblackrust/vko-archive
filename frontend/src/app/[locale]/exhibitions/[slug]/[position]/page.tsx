import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchPublic, type ExhibitionDetail } from "@/components/exhibitions/api";
import { ExhibitImage } from "@/components/exhibitions/exhibit-image";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ShareButtons } from "@/components/layout/share-buttons";
import { Button } from "@/components/ui/button";
import { NotFoundState, UnavailableState } from "@/components/ui/state-view";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

async function load(slug: string, locale: string): Promise<ExhibitionDetail | null | undefined> {
  try {
    return await fetchPublic<ExhibitionDetail>(`exhibitions/${encodeURIComponent(slug)}`, new URLSearchParams(), locale);
  } catch {
    return undefined;
  }
}

/** Просмотр экспоната: изображение с зумом, подпись, источник, шифр, переход к документу, пред./след. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string; position: string }> }) {
  const { locale, slug, position } = await params;
  const exhibition = await load(slug, locale);
  const index = /^\d{1,4}$/.test(position) ? Number(position) - 1 : -1;
  return {
    title: exhibition?.exhibits[index]?.title,
    alternates: localizedAlternates(locale, `/exhibitions/${slug}/${position}`),
  };
}

export default async function ExhibitPage({ params }: { params: Promise<{ locale: string; slug: string; position: string }> }) {
  const { locale, slug, position } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("exhibitions");
  const exhibition = await load(slug, locale);
  if (exhibition === undefined) return <UnavailableState />;
  const index = /^\d{1,4}$/.test(position) ? Number(position) - 1 : -1;
  const exhibit = exhibition?.exhibits[index];
  if (!exhibition || !exhibit) return <NotFoundState />;
  const total = exhibition.exhibits.length;
  const base = `/exhibitions/${exhibition.slug}`;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: t("title"), href: "/exhibitions" },
          { label: exhibition.title, href: base },
          { label: exhibit.title },
        ]}
      />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("exhibit.counter", { n: exhibit.position, total })}</p>
          <h1 className="break-words text-3xl font-bold">
            {exhibit.title}
          </h1>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-4">
            {exhibit.media ? (
              <ExhibitImage url={exhibit.media.url} alt={exhibit.caption || exhibit.title} />
            ) : (
              <p className="rounded-lg border bg-surface-muted p-6 text-muted-foreground">{t("detail.noImage")}</p>
            )}
            {exhibit.video_url && (
              <p>
                <a href={exhibit.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="size-4" aria-hidden /> {t("exhibit.video")}
                </a>
              </p>
            )}
          </div>
          <aside className="space-y-3 self-start rounded-lg border bg-surface p-4">
            <dl className="space-y-3 text-sm">
              {exhibit.caption && (
                <div>
                  <dt className="font-medium">{t("exhibit.caption")}</dt>
                  <dd className="whitespace-pre-line">{exhibit.caption}</dd>
                </div>
              )}
              {exhibit.source && (
                <div>
                  <dt className="font-medium">{t("exhibit.source")}</dt>
                  <dd>{exhibit.source}</dd>
                </div>
              )}
              {exhibit.archive_code && (
                <div>
                  <dt className="font-medium">{t("exhibit.code")}</dt>
                  <dd className="break-all font-mono">{exhibit.archive_code}</dd>
                </div>
              )}
            </dl>
            {exhibit.document_href && (
              <Button asChild variant="outline" size="sm">
                <Link href={exhibit.document_href}>{t("exhibit.toDocument")}</Link>
              </Button>
            )}
            <ShareButtons title={exhibit.title} />
          </aside>
        </div>

        <nav aria-label={t("exhibit.counter", { n: exhibit.position, total })} className="flex flex-wrap items-center justify-between gap-2">
          {index > 0 ? (
            <Button asChild variant="outline">
              <Link href={`${base}/${exhibit.position - 1}`} rel="prev"><ChevronLeft aria-hidden /> {t("exhibit.prev")}</Link>
            </Button>
          ) : <span />}
          <Button asChild variant="ghost">
            <Link href={base}>{t("exhibit.back")}</Link>
          </Button>
          {index < total - 1 ? (
            <Button asChild variant="outline">
              <Link href={`${base}/${exhibit.position + 1}`} rel="next">{t("exhibit.next")} <ChevronRight aria-hidden /></Link>
            </Button>
          ) : <span />}
        </nav>
      </div>
    </>
  );
}
