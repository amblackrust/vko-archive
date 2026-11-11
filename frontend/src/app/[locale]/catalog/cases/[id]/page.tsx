import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CipherChip } from "@/components/catalog/cipher-chip";
import { DocumentCard } from "@/components/catalog/document-card";
import { DocumentRow } from "@/components/catalog/document-row";
import { LevelLead, LevelList, TileGrid } from "@/components/catalog/hierarchy";
import { KeyFacts } from "@/components/ui/facts";
import { PageHeader } from "@/components/ui/page-header";
import { RecordList } from "@/components/ui/record-list";
import { UnavailableState } from "@/components/ui/state-view";
import { catalogLoad, listPage, type CaseDetail, type SearchParams } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<SearchParams> };

const load = (id: string, query: URLSearchParams, locale: string) => catalogLoad<CaseDetail>(`cases/${encodeURIComponent(id)}`, query, locale);

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  const item = await load(id, new URLSearchParams(), locale);
  const cipher = item && t("tree.cipher.case", { fund: item.fund.number, inventory: item.inventory.number, case: item.number });
  return { title: item ? [cipher, item.title].filter(Boolean).join(". ") : t("title"), alternates: localizedAlternates(locale, `/catalog/cases/${id}`) };
}

/** Дело: шифр, опись и фонд в шапке, полоса сведений, документы дела плитками с изображениями. */
export default async function CasePage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const query = listPage(await searchParams);
  const item = await load(id, query, locale);
  if (item === undefined) return <UnavailableState />;
  if (!item) notFound();
  const label = t("tree.caseOf", { number: item.number });
  const foreign = Boolean(item.title) && item.title_lang !== locale;
  return (
    <>
      <PageHeader
        crumbs={[
          { label: t("title"), href: "/catalog" },
          { label: t("tree.fundOf", { number: item.fund.number }), href: item.fund.href },
          { label: t("tree.inventoryOf", { number: item.inventory.number }), href: item.inventory.href },
          { label },
        ]}
        title={item.title || label}
        titleLang={foreign ? item.title_lang : undefined}
        meta={<CipherChip>{t("tree.cipher.case", { fund: item.fund.number, inventory: item.inventory.number, case: item.number })}</CipherChip>}
        lead={<LevelLead fund={item.fund} inventory={item.inventory} />}
      />
      <div className="container-page space-y-10 pb-16">
        <KeyFacts
          items={[
            { label: t("tree.facts.fundNumber"), value: <span className="cipher">{item.fund.number}</span> },
            { label: t("tree.facts.inventoryNumber"), value: <span className="cipher">{item.inventory.number}</span> },
            { label: t("tree.facts.dates"), value: item.dates_text },
            { label: t("tree.facts.sheets"), value: item.sheets_count },
            { label: t("tree.facts.documents"), value: item.document_count },
          ]}
        />
        <LevelList heading={t("tree.documentsInCase")} pathname={item.href} query={query} list={item.documents} empty={t("tree.emptyDocuments")} search={item.document_count > 8}>
          {/* Один-два документа — строками: плитка с изображением на полэкрана выглядела бы афишей. */}
          {item.documents.items.length < 3 ? (
            <RecordList>{item.documents.items.map((doc) => <DocumentRow key={doc.id} item={doc} fund={false} />)}</RecordList>
          ) : (
            <TileGrid quiet count={item.documents.items.length} min={3} more={{ href: item.inventory.href, title: t("tree.otherCases"), text: item.inventory.title }}>
              {item.documents.items.map((doc) => <DocumentCard key={doc.id} item={doc} />)}
            </TileGrid>
          )}
        </LevelList>
      </div>
    </>
  );
}
