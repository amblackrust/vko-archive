import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { GetForm } from "@/components/catalog/get-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { RecordList, RecordRow } from "@/components/ui/record-list";
import { UnavailableState } from "@/components/ui/state-view";
import { catalogList, listPage, type List, type NewspaperItem, type SearchParams } from "@/lib/api/catalog";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog.newspapers" });
  return { title: t("title"), description: t("intro"), alternates: localizedAlternates(locale, "/catalog/newspapers") };
}

/** Газетный фонд: какие газеты и за какие годы хранит архив (сведения из открытого перечня архива). */
export default async function NewspapersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const query = listPage(await searchParams);
  const data = await catalogList<List<NewspaperItem>>("newspapers", query, locale);
  if (!data) return <UnavailableState />;
  const year = Number(query.get("year")) || null;
  return (
    <>
      <PageHeader crumbs={[{ label: t("title"), href: "/catalog" }, { label: t("newspapers.title") }]} title={t("newspapers.title")} lead={t("newspapers.intro")} />
      <div className="container-page space-y-6 py-8 pb-16">
        <CatalogNav active="newspapers" />
        <GetForm key={query.toString()} pathname="/catalog/newspapers" role="search" aria-label={t("newspapers.title")} className="grid gap-4 card p-5 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
          <Field label={t("newspapers.q")} name="q" type="search" defaultValue={query.get("q") ?? ""} placeholder={t("newspapers.qPlaceholder")} />
          <Field label={t("funds.year")} name="year" type="number" min={1900} max={2100} defaultValue={query.get("year") ?? ""} placeholder="1961" />
          <div className="flex gap-2">
            <Button type="submit" className="h-11 px-6">{t("tree.searchSubmit")}</Button>
            {(query.get("q") || year) && <Button asChild variant="outline" className="h-11"><Link href="/catalog/newspapers">{t("filters.reset")}</Link></Button>}
          </div>
        </GetForm>
        <section aria-labelledby="newspapers-results">
          <h2 id="newspapers-results" aria-live="polite" className="text-lg">{t("results.count", { count: data.total })}</h2>
          {data.items.length === 0 ? (
            <p className="card mt-4 p-6 text-muted-foreground">{t("newspapers.empty")}</p>
          ) : (
            <RecordList className="mt-4">
              {data.items.map((item) => {
                const years = [...new Set(item.years.map((entry) => entry.year))];
                return (
                  <RecordRow
                    key={item.id}
                    title={item.title}
                    meta={item.publisher}
                    aside={
                      <>
                        <span className="font-medium">{item.year_from === item.year_to ? item.year_from : t("tree.years", { from: item.year_from, to: item.year_to })}</span>
                        <span className="text-muted-foreground">{t("newspapers.volumes", { count: item.volumes_total })}</span>
                      </>
                    }
                  >
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer font-medium text-primary">{t("newspapers.years", { count: years.length })}</summary>
                      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
                        {years.map((value) => <li key={value} className={value === year ? "font-bold text-primary" : undefined}>{value}</li>)}
                      </ul>
                    </details>
                  </RecordRow>
                );
              })}
            </RecordList>
          )}
        </section>
        <Pagination pathname="/catalog/newspapers" params={query} page={data.page} pages={data.pages} />
        <p className="max-w-3xl text-sm text-muted-foreground">{t("newspapers.sourceNote")}</p>
      </div>
    </>
  );
}
