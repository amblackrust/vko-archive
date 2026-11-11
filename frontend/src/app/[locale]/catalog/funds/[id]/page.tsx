import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AskAssistant } from "@/components/ai/chat/ask-assistant";
import { CipherChip } from "@/components/catalog/cipher-chip";
import { InventoryRow } from "@/components/catalog/hierarchy";
import { enumLabel, fundYears } from "@/components/catalog/labels";
import { TrackRecent } from "@/components/catalog/recent";
import { DemoTag } from "@/components/ui/demo-tag";
import { FactList, KeyFacts } from "@/components/ui/facts";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { RecordList } from "@/components/ui/record-list";
import { UnavailableState } from "@/components/ui/state-view";
import { catalogLoad, type FundDetail } from "@/lib/api/catalog";
import { formatIsoDate } from "@/lib/dates";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: string; id: string }> };

const load = (id: string, locale: string) => catalogLoad<FundDetail>(`funds/${encodeURIComponent(id)}`, new URLSearchParams(), locale);

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  const fund = await load(id, locale);
  return {
    // Официальные названия фондов длинные: в заголовке вкладки — номер и начало названия.
    title: fund ? `${t("tree.fundOf", { number: fund.number })}. ${fund.title.length > 70 ? `${fund.title.slice(0, 70)}…` : fund.title}` : t("title"),
    alternates: localizedAlternates(locale, `/catalog/funds/${id}`),
  };
}

export default async function FundPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const fund = await load(id, locale);
  if (fund === undefined) return <UnavailableState />;
  if (!fund) notFound();
  return (
    <>
      <PageHeader
        crumbs={[
          { label: t("title"), href: "/catalog" },
          { label: t("tree.fundsTitle"), href: "/catalog/funds" },
          { label: t("tree.fundOf", { number: fund.number }) },
        ]}
        title={fund.title}
        titleLang={fund.title_lang}
        lead={fund.annotation ? <p lang={fund.title_lang}>{fund.annotation}</p> : undefined}
        meta={
          <>
            <CipherChip>{t("tree.fundOf", { number: fund.number })}</CipherChip>
            {fund.is_demo && <DemoTag />}
          </>
        }
      >
        {fund.restricted === "partial" && <Notice tone="warning" className="max-w-3xl">{t("funds.partialNote")}</Notice>}
      </PageHeader>

      <TrackRecent href={`/catalog/funds/${fund.id}`} code={fund.number} title={fund.title} />
      <div className="container-page space-y-8 pb-16">
        <KeyFacts
          items={[
            { label: t("funds.facts.years"), value: fundYears(t, fund) },
            { label: t("funds.facts.units"), value: fund.units_count?.toLocaleString("ru-RU") },
            { label: t("funds.facts.type"), value: enumLabel(t, "fundTypes", fund.type) },
            { label: t("funds.facts.category"), value: fund.category && t("funds.categoryValue", { category: fund.category }) },
          ]}
        />

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-10">
            {fund.former_names.length > 1 && (
              <section aria-labelledby="fund-names">
                <h2 id="fund-names" className="text-2xl">{t("funds.namesTitle")}</h2>
                <p className="mt-1.5 max-w-3xl text-muted-foreground">{t("funds.namesText")}</p>
                {/* Названия идут по времени: линия с отметками, последнее (действующее) выделено. */}
                <ol className="card mt-5 p-6 sm:p-8">
                  {fund.former_names.map((entry, index) => {
                    const last = index === fund.former_names.length - 1;
                    return (
                      <li key={index} className="relative pb-6 pl-8 last:pb-0">
                        {!last && <span className="absolute bottom-0 left-[0.3125rem] top-3 w-0.5 bg-primary-soft" aria-hidden />}
                        <span className={cn("absolute left-0 top-1.5 size-3 rounded-full border-2 border-primary", last ? "bg-primary" : "bg-surface")} aria-hidden />
                        <p className="text-sm font-semibold tabular-nums text-primary">{entry.dates ?? t("funds.noDates")}</p>
                        <p className={cn("mt-0.5", last && "font-semibold")} lang={fund.title_lang}>{entry.name}</p>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            <section aria-labelledby="fund-inventories">
              <h2 id="fund-inventories" className="text-2xl">{t("tree.inventoriesInFund")}</h2>
              {fund.inventories.length === 0 ? (
                <p className="card mt-5 p-6 text-muted-foreground">
                  {t("funds.noInventories")}{" "}
                  <Link href="/help/reading-room" className="text-link">{t("funds.readingRoom")}</Link>
                </p>
              ) : (
                <RecordList className="mt-5">{fund.inventories.map((item) => <InventoryRow key={item.id} item={item} />)}</RecordList>
              )}
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24">
            {!fund.is_demo && (
              <div className="on-brand rounded-lg p-6">
                <h2 className="text-lg">{t("funds.certificate.title")}</h2>
                <p className="mt-2 text-[0.9375rem] text-muted-foreground">{t("funds.certificate.text", { number: fund.number })}</p>
                <Link href="/services/state" className="mt-5 inline-flex h-11 items-center rounded-md bg-white px-5 text-[0.9375rem] font-semibold text-[#2536b0] transition-transform hover:-translate-y-0.5">
                  {t("funds.certificate.link")}
                </Link>
              </div>
            )}
            <AskAssistant question={t("funds.ask.question", { number: fund.number })} className="card lift flex w-full items-center gap-3 p-4 text-left font-semibold text-primary">
              {t("funds.ask.button")}
            </AskAssistant>
            <FactList
              items={[
                { label: t("funds.facts.storage"), value: fund.branch && <Link href={fund.branch.href} className="text-link">{fund.branch.name}</Link> },
                { label: t("funds.facts.ownership"), value: fund.ownership && t(`funds.ownership.${fund.ownership}`) },
                { label: t("funds.facts.received"), value: formatIsoDate(fund.first_received, locale) },
              ]}
            />
            {fund.source && <p className="text-sm text-muted-foreground">{t("funds.source", { source: fund.source })}</p>}
          </aside>
        </div>
      </div>
    </>
  );
}
