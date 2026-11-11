import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { HeroField, ListHero } from "@/components/catalog/list-hero";
import { NewspaperRow, yearAxis } from "@/components/catalog/newspaper-row";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
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
  const filtered = Boolean(query.get("q") || year);
  const axis = yearAxis(data.items);
  return (
    <>
      <ListHero
        crumbs={[{ label: t("title"), href: "/catalog" }, { label: t("newspapers.title") }]}
        title={t("newspapers.title")}
        lead={t("newspapers.intro")}
        pathname="/catalog/newspapers"
        formKey={query.toString()}
        formLabel={t("newspapers.title")}
        input={{ id: "newspapers-q", label: t("newspapers.q"), placeholder: t("newspapers.qPlaceholder"), value: query.get("q") ?? "" }}
        submit={t("tree.searchSubmit")}
        fields={<HeroField label={t("newspapers.year")} name="year" type="number" min={1900} max={2100} defaultValue={query.get("year") ?? ""} placeholder={t("newspapers.yearPlaceholder")} className="w-full sm:w-56" />}
      />
      <div className="container-page space-y-6 pb-16">
        <CatalogNav active="newspapers" />
        <section aria-labelledby="newspapers-results" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h2 id="newspapers-results" aria-live="polite" className="text-xl">{t("results.count", { count: data.total })}</h2>
            {filtered && <Button asChild variant="outline" size="sm"><Link href="/catalog/newspapers">{t("filters.reset")}</Link></Button>}
          </div>
          {data.items.length === 0 ? (
            <p className="card p-6 text-muted-foreground sm:p-8">{t("newspapers.empty")}</p>
          ) : (
            <div className="card overflow-hidden">
              {/* Шапка списка: подписи колонок и шкала лет для полос. */}
              <div className="hidden gap-x-8 border-b px-6 py-2.5 text-sm text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_19rem]" aria-hidden>
                <span>{t("newspapers.columnTitle")}</span>
                <span className="flex justify-between tabular-nums">{axis.ticks.map((tick) => <span key={tick}>{tick}</span>)}</span>
              </div>
              <ul className="divide-y">
                {data.items.map((item) => <NewspaperRow key={item.id} item={item} axis={axis} year={year} />)}
              </ul>
            </div>
          )}
          <Pagination pathname="/catalog/newspapers" params={query} page={data.page} pages={data.pages} />
          <p className="max-w-3xl text-sm text-muted-foreground">{t("newspapers.sourceNote")}</p>
        </section>
      </div>
    </>
  );
}
