import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocumentCard } from "@/components/catalog/document-card";
import { safe } from "@/components/misc/api";
import { PageSection, PageStack } from "@/components/misc/blocks";
import { pageMetadata } from "@/components/misc/metadata";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { catalogFetch, type DocumentsResponse } from "@/lib/api/catalog";

const PHOTOS = "/catalog?doc_type=photo";
const ITEMS = [
  { id: "news", href: "/news" },
  { id: "collections", href: "/memory" },
  { id: "photos", href: PHOTOS },
  { id: "exhibitions", href: "/exhibitions" },
  { id: "newspapers", href: "/catalog/newspapers" },
  { id: "timeline", href: "/memory/timeline" },
] as const;

export const generateMetadata = pageMetadata("misc.publications", "/publications");

/** Публицистика, сборники и фотогалерея: вход в разделы, где эти материалы опубликованы, и фотографии из каталога. */
export default async function PublicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("misc.publications");
  const result = await safe(catalogFetch<DocumentsResponse>("documents", new URLSearchParams({ doc_type: "photo", per_page: "12" }), locale));
  const photos = (result?.items ?? []).filter((item) => item.preview_url && !item.is_demo).slice(0, 4);

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageStack>
        <ul className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ id, href }) => (
            <li key={id}><LinkTile href={href} title={t(`items.${id}.title`)} text={t(`items.${id}.text`)} className="p-6" /></li>
          ))}
        </ul>

        {photos.length === 4 && (
          <PageSection id="photos" title={t("gallery.title")} link={{ href: PHOTOS, label: t("gallery.all") }}>
            <ul className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-4">
              {photos.map((item) => <DocumentCard key={item.id} item={item} />)}
            </ul>
          </PageSection>
        )}
      </PageStack>
    </>
  );
}
