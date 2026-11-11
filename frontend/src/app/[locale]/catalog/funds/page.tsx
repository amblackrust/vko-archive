import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { FundRow } from "@/components/catalog/fund-row";
import { GetForm } from "@/components/catalog/get-form";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { RecordList } from "@/components/ui/record-list";
import { UnavailableState } from "@/components/ui/state-view";
import { catalogList, FUND_SORTS, listPage, type FundItem, type List, type SearchParams } from "@/lib/api/catalog";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

const TYPES = ["organization", "party", "personal"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("tree.fundsTitle"), description: t("funds.intro"), alternates: localizedAlternates(locale, "/catalog/funds") };
}

export default async function FundsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const query = listPage(await searchParams);
  const personal = query.get("type") === "personal";
  const data = await catalogList<List<FundItem>>("funds", query, locale);
  if (!data) return <UnavailableState />;
  const title = personal ? t("tree.personalTitle") : t("tree.fundsTitle");
  const filtered = ["q", "type", "year", "category"].some((key) => query.get(key));
  return (
    <>
      <PageHeader crumbs={[{ label: t("title"), href: "/catalog" }, { label: title }]} title={title} lead={t("funds.intro")} />
      <div className="container-page space-y-6 py-8 pb-16">
        <CatalogNav active={personal ? "personalFunds" : "funds"} />

        <GetForm key={query.toString()} pathname="/catalog/funds" role="search" aria-label={t("funds.searchLabel")} className="grid gap-4 card p-5 lg:grid-cols-[1fr_11rem_8rem_10rem_auto] lg:items-end">
          <Field label={t("funds.q")} name="q" type="search" defaultValue={query.get("q") ?? ""} placeholder={t("funds.qPlaceholder")} />
          <SelectField
            label={t("funds.type")}
            name="type"
            defaultValue={query.get("type") ?? ""}
            options={[{ value: "", label: t("funds.any") }, ...TYPES.map((type) => ({ value: type, label: t(`fundTypes.${type}`) }))]}
          />
          <Field label={t("funds.year")} name="year" type="number" min={1700} max={2100} defaultValue={query.get("year") ?? ""} placeholder="1955" />
          <SelectField
            label={t("sort.label")}
            name="sort"
            defaultValue={query.get("sort") ?? ""}
            options={[{ value: "", label: t("funds.sort.relevance") }, ...FUND_SORTS.map((sort) => ({ value: sort, label: t(`funds.sort.${sort}`) }))]}
          />
          <div className="flex gap-2">
            <Button type="submit" className="h-11 px-6">{t("tree.searchSubmit")}</Button>
            {filtered && <Button asChild variant="outline" className="h-11"><Link href="/catalog/funds">{t("filters.reset")}</Link></Button>}
          </div>
        </GetForm>

        <section aria-labelledby="funds-results">
          <h2 id="funds-results" aria-live="polite" className="text-lg">{t("results.count", { count: data.total })}</h2>
          {data.items.length === 0 ? (
            <div className="card mt-4 space-y-2 p-6">
              <p className="text-lg font-semibold">{t("funds.emptyTitle")}</p>
              <p className="text-muted-foreground">{t("funds.emptyText")}</p>
            </div>
          ) : (
            <RecordList className="mt-4">{data.items.map((item) => <FundRow key={item.id} fund={item} />)}</RecordList>
          )}
        </section>
        <Pagination pathname="/catalog/funds" params={query} page={data.page} pages={data.pages} />
        <p className="max-w-3xl text-sm text-muted-foreground">{t("funds.sourceNote")}</p>
      </div>
    </>
  );
}
