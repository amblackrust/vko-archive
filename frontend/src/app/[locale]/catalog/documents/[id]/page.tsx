import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocumentAiPanel } from "@/components/ai/document/document-ai-panel";
import { FavoriteButton } from "@/components/cabinet/favorite-button";
import { AccessBadge } from "@/components/catalog/access-badge";
import { TrackRecent } from "@/components/catalog/recent";
import { CipherChip } from "@/components/catalog/cipher-chip";
import { DocumentRow } from "@/components/catalog/document-row";
import { enumLabel } from "@/components/catalog/labels";
import { AccessPanel } from "@/components/document/access-panel";
import { CardActions } from "@/components/document/card-actions";
import { DocumentFacts } from "@/components/document/facts";
import { ShareButtons } from "@/components/layout/share-buttons";
import { SimilarMaterials } from "@/components/recommendations/similar-materials";
import { DemoBadge } from "@/components/ui/demo-badge";
import { DemoTag } from "@/components/ui/demo-tag";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { RecordList } from "@/components/ui/record-list";
import { UnavailableState } from "@/components/ui/state-view";
import { DocumentViewer } from "@/components/viewer/document-viewer";
import { catalogLoad } from "@/lib/api/catalog";
import type { DocumentDetail } from "@/lib/api/document";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; id: string }> };

const load = (locale: string, id: string, session?: string) =>
  catalogLoad<DocumentDetail>(`documents/${encodeURIComponent(id)}`, new URLSearchParams(), locale, session);

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const doc = await load(locale, id);
  const t = await getTranslations({ locale, namespace: "document" });
  return {
    title: doc ? [doc.title, doc.archive_code].filter(Boolean).join(". ") : t("pageTitle"),
    description: doc?.summary || undefined,
    alternates: localizedAlternates(locale, `/catalog/documents/${id}`),
  };
}

/** Карточка документа: сначала просмотр (или условия доступа), затем описание и вопросы помощнику; сбоку — все поля записи. */
export default async function DocumentPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("document");
  const c = await getTranslations("catalog");
  const l = await getTranslations("layout");
  // Скрытый, неопубликованный и несуществующий документ неотличимы: 404 без подробностей.
  // Сессия сотрудника (httpOnly cookie) передаётся в API: он увидит доступные ему закрытые файлы. Анонимам — как раньше.
  const session = (await cookies()).get("vko_session")?.value;
  const doc = await load(locale, id, session);
  if (doc === undefined) return <UnavailableState />;
  if (!doc) notFound();

  const foreign = doc.title_lang !== locale;
  const contentLang = foreign ? doc.title_lang : undefined;
  const chain = doc.fund && doc.inventory && doc.case
    ? [
        { label: c("tree.fundOf", { number: doc.fund.number }), href: doc.fund.href },
        { label: c("tree.inventoryOf", { number: doc.inventory.number }), href: doc.inventory.href },
        { label: c("tree.caseOf", { number: doc.case.number }), href: doc.case.href },
      ]
    : [];
  const h2 = "text-2xl";

  return (
    <>
      <TrackRecent href={`/catalog/documents/${doc.id}`} code={doc.archive_code ?? "—"} title={doc.title} />
      <PageHeader
        crumbs={[{ label: c("title"), href: "/catalog" }, ...chain, { label: t("breadcrumb") }]}
        title={doc.title}
        titleLang={contentLang}
        lead={[doc.doc_type && enumLabel(c, "docTypes", doc.doc_type), doc.date_text].filter(Boolean).join(", ") || undefined}
        meta={
          <>
            {doc.archive_code && <CipherChip><span className="sr-only">{t("fields.code")}: </span>{doc.archive_code}</CipherChip>}
            <AccessBadge access={doc.file_access} />
            {doc.is_demo && <DemoTag />}
            {foreign && <DemoBadge kind="noTranslation" />}
          </>
        }
        actions={
          <>
            <CardActions code={doc.archive_code} citation={[doc.title, doc.date_text, `// ${l("siteName")}`, doc.archive_code].filter(Boolean).join(". ") + "."} />
            <FavoriteButton type="document" id={doc.id} />
            <ShareButtons title={doc.title} />
          </>
        }
      />

      <div className="container-page space-y-14 py-8 pb-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-10">
            {doc.files.length > 0 ? (
              <DocumentViewer files={doc.files} title={doc.title} />
            ) : (
              <AccessPanel access={doc.file_access} conditions={doc.access_conditions} lang={doc.title_lang} />
            )}
            {doc.summary && (
              <section aria-labelledby="doc-summary" className="max-w-3xl space-y-3">
                <h2 id="doc-summary" className={h2}>{t("sections.description")}</h2>
                <p className="reading whitespace-pre-line" lang={contentLang}>{doc.summary}</p>
              </section>
            )}
            {doc.historical_note && (
              <section aria-labelledby="doc-note" className="max-w-3xl space-y-3">
                <h2 id="doc-note" className={h2}>{t("sections.historicalNote")}</h2>
                <p className="reading whitespace-pre-line" lang={contentLang}>{doc.historical_note}</p>
              </section>
            )}
            {doc.file_access === "open" && <DocumentAiPanel documentId={doc.id} />}
            {doc.annotation && (
              <section aria-labelledby="doc-annotation" className="max-w-3xl space-y-3">
                <h2 id="doc-annotation" className={h2}>{t("annotation.title")}</h2>
                <p className="reading whitespace-pre-line" lang={doc.annotation.lang}>{doc.annotation.text}</p>
                <Notice>{doc.annotation.label}. {t("annotation.note")}</Notice>
              </section>
            )}
          </div>

          <aside aria-labelledby="doc-facts" className="space-y-3 self-start lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
            <h2 id="doc-facts" className="text-lg">{t("sections.details")}</h2>
            <DocumentFacts doc={doc} />
          </aside>
        </div>

        {doc.related.length > 0 && (
          <section aria-labelledby="doc-related" className="space-y-4">
            <h2 id="doc-related" className={h2}>{t("sections.related")}</h2>
            <RecordList>{doc.related.map((item) => <DocumentRow key={item.id} item={item} />)}</RecordList>
          </section>
        )}
        <SimilarMaterials type="document" id={doc.id} types={["exhibition", "collection", "news"]} />
      </div>
    </>
  );
}
