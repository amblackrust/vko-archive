import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CipherChip } from "@/components/catalog/cipher-chip";
import { CaseTile, LevelLead, LevelList, TileGrid } from "@/components/catalog/hierarchy";
import { KeyFacts } from "@/components/ui/facts";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableState } from "@/components/ui/state-view";
import { catalogLoad, listPage, type InventoryDetail, type SearchParams } from "@/lib/api/catalog";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<SearchParams> };

const load = (id: string, query: URLSearchParams, locale: string) =>
  catalogLoad<InventoryDetail>(`inventories/${encodeURIComponent(id)}`, query, locale);

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  const item = await load(id, new URLSearchParams(), locale);
  const cipher = item && t("tree.cipher.inventory", { fund: item.fund.number, inventory: item.number });
  return { title: item ? [cipher, item.title].filter(Boolean).join(". ") : t("title"), alternates: localizedAlternates(locale, `/catalog/inventories/${id}`) };
}

/** Опись: шифр и фонд в шапке, полоса сведений, дела описи плитками. */
export default async function InventoryPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const query = listPage(await searchParams);
  const inventory = await load(id, query, locale);
  if (inventory === undefined) return <UnavailableState />;
  if (!inventory) notFound();
  const label = t("tree.inventoryOf", { number: inventory.number });
  const foreign = Boolean(inventory.title) && inventory.title_lang !== locale;
  return (
    <>
      <PageHeader
        crumbs={[
          { label: t("title"), href: "/catalog" },
          { label: t("tree.fundOf", { number: inventory.fund.number }), href: inventory.fund.href },
          { label },
        ]}
        title={inventory.title || label}
        titleLang={foreign ? inventory.title_lang : undefined}
        meta={<CipherChip>{t("tree.cipher.inventory", { fund: inventory.fund.number, inventory: inventory.number })}</CipherChip>}
        lead={<LevelLead fund={inventory.fund} />}
      />
      <div className="container-page space-y-10 pb-16">
        <KeyFacts
          items={[
            { label: t("tree.facts.fundNumber"), value: <span className="cipher">{inventory.fund.number}</span> },
            { label: t("tree.facts.inventoryNumber"), value: <span className="cipher">{inventory.number}</span> },
            { label: t("tree.facts.dates"), value: inventory.dates_text },
            { label: t("tree.facts.cases"), value: inventory.case_count },
            { label: t("tree.facts.documents"), value: inventory.document_count },
          ]}
        />
        <LevelList heading={t("tree.casesInInventory")} pathname={inventory.href} query={query} list={inventory.cases} empty={t("tree.emptyCases")} search={inventory.case_count > 8}>
          <TileGrid count={inventory.cases.items.length} more={{ href: inventory.fund.href, title: t("tree.otherInventories"), text: inventory.fund.title }}>
            {inventory.cases.items.map((item) => <CaseTile key={item.id} item={item} />)}
          </TileGrid>
        </LevelList>
      </div>
    </>
  );
}
