import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocumentAiPanel } from "@/components/ai/document/document-ai-panel";
import { AccessNotice } from "@/components/document/access-notice";
import { AnnotationBlock } from "@/components/document/annotation-block";
import { FavoriteButton } from "@/components/cabinet/favorite-button";
import { CardActions } from "@/components/document/card-actions";
import { ShareButtons } from "@/components/layout/share-buttons";
import { DocumentDetails } from "@/components/document/details";
import { RelatedDocuments } from "@/components/document/related";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PersonalRecommendations } from "@/components/recommendations/personal-recommendations";
import { DocumentViewer } from "@/components/viewer/document-viewer";
import { DemoBadge } from "@/components/ui/demo-badge";
import { catalogFetch } from "@/lib/api/catalog";
import type { DocumentDetail } from "@/lib/api/document";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; id: string }> };

async function load(locale: string, id: string) {
  return catalogFetch<DocumentDetail>(`documents/${encodeURIComponent(id)}`, new URLSearchParams(), locale);
}

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const doc = await load(locale, id);
  const t = await getTranslations({ locale, namespace: "document" });
  return { title: doc?.title ?? t("pageTitle"), alternates: localizedAlternates(locale, `/catalog/documents/${id}`) };
}

export default async function DocumentPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("document");
  const c = await getTranslations("catalog");
  // Скрытый, неопубликованный и несуществующий документ неотличимы: 404 без подробностей.
  const doc = await load(locale, id);
  if (!doc) notFound();

  const crumbs = [{ label: c("title"), href: "/catalog" }];
  if (doc.fund && doc.inventory && doc.case) {
    crumbs.push(
      { label: c("tree.fundOf", { number: doc.fund.number }), href: doc.fund.href },
      { label: c("tree.inventoryOf", { number: doc.inventory.number }), href: doc.inventory.href },
      { label: c("tree.caseOf", { number: doc.case.number }), href: doc.case.href },
    );
  }

  return (
    <>
      <Breadcrumbs items={[...crumbs, { label: t("breadcrumb") }]} />
      <div className="container-page space-y-8 pb-12">
        <header className="space-y-3">
          <h1 className="break-words text-3xl font-bold" lang={doc.title_lang}>
            {doc.title}
            {doc.is_demo && <DemoBadge className="ml-3 align-middle" />}
          </h1>
          {doc.archive_code && (
            <p className="text-muted-foreground">
              {t("fields.code")}: <span className="break-all font-mono text-foreground">{doc.archive_code}</span>
            </p>
          )}
          <CardActions code={doc.archive_code} title={doc.title} />
          <div className="flex flex-wrap items-center gap-4">
            <ShareButtons title={doc.title} />
            <FavoriteButton type="document" id={doc.id} />
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-8">
            {doc.files.length > 0 ? (
              <DocumentViewer files={doc.files} title={doc.title} />
            ) : (
              <AccessNotice access={doc.file_access} conditions={doc.access_conditions} />
            )}
            {doc.file_access === "open" && <DocumentAiPanel documentId={doc.id} />}
            {doc.annotation && <AnnotationBlock annotation={doc.annotation} />}
            {doc.summary && (
              <section aria-labelledby="summary-title" className="space-y-2">
                <h2 id="summary-title" className="text-xl font-semibold">{t("sections.description")}</h2>
                <p className="whitespace-pre-line" lang={doc.title_lang}>{doc.summary}</p>
              </section>
            )}
            {doc.historical_note && (
              <section aria-labelledby="note-title" className="space-y-2">
                <h2 id="note-title" className="text-xl font-semibold">{t("sections.historicalNote")}</h2>
                <p className="whitespace-pre-line" lang={doc.title_lang}>{doc.historical_note}</p>
              </section>
            )}
          </div>
          <aside aria-labelledby="details-title" className="space-y-3 self-start rounded-lg border bg-surface p-4">
            <h2 id="details-title" className="text-lg font-semibold">{t("sections.details")}</h2>
            <DocumentDetails doc={doc} />
          </aside>
        </div>

        <RelatedDocuments items={doc.related} />
        <PersonalRecommendations documentId={doc.id} />
      </div>
    </>
  );
}
