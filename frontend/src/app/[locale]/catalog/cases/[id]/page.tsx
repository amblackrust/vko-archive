import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CipherChip } from "@/components/catalog/cipher-chip";
import { DocumentRow } from "@/components/catalog/document-row";
import { CipherPath, Level, LevelList } from "@/components/catalog/hierarchy";
import { DemoBadge } from "@/components/ui/demo-badge";
import { DemoTag } from "@/components/ui/demo-tag";
import { PageHeader } from "@/components/ui/page-header";
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

/** Дело: путь по шифру, документы дела с поиском, сведения о деле. */
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
        meta={
          <>
            <CipherChip>{t("tree.cipher.case", { fund: item.fund.number, inventory: item.inventory.number, case: item.number })}</CipherChip>
            {item.is_demo && <DemoTag />}
            {foreign && <DemoBadge kind="noTranslation" />}
          </>
        }
      />
      <Level
        path={<CipherPath fund={item.fund} inventory={item.inventory} archiveCase={item} />}
        facts={[
          { label: t("tree.facts.fund"), value: item.fund.title },
          { label: t("tree.facts.dates"), value: item.dates_text },
          { label: t("tree.facts.sheets"), value: item.sheets_count },
          { label: t("tree.facts.documents"), value: item.document_count },
        ]}
      >
        <LevelList heading={t("tree.documentsInCase")} pathname={item.href} query={query} list={item.documents} empty={t("tree.emptyDocuments")}>
          {item.documents.items.map((doc) => <DocumentRow key={doc.id} item={doc} fund={false} />)}
        </LevelList>
      </Level>
    </>
  );
}
