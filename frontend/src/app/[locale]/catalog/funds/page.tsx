import { SlidersHorizontal } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogNav } from "@/components/catalog/catalog-nav";
import { FundRow } from "@/components/catalog/fund-row";
import { ListHero } from "@/components/catalog/list-hero";
import { SortSelect } from "@/components/catalog/sort-select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LinkTile } from "@/components/ui/link-tile";
import { Pagination } from "@/components/ui/pagination";
import { RecordList } from "@/components/ui/record-list";
import { UnavailableState } from "@/components/ui/state-view";
import { catalogList, catalogLoad, FUND_SORTS, listPage, type FundItem, type List, type SearchParams } from "@/lib/api/catalog";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

const TYPES = ["organization", "party", "personal"] as const;
/** Поля панели фильтров и сортировка лежат вне <form> и привязаны к строке поиска атрибутом `form` (работает без JS). */
const FORM = "funds-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("tree.fundsTitle"), description: t("funds.intro"), alternates: localizedAlternates(locale, "/catalog/funds") };
}

/** Перечень фондов: строка поиска, фильтр по типу (с числом фондов) и году, строки справочника. Состояние — в адресе. */
export default async function FundsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const query = listPage(await searchParams);
  const type = query.get("type") ?? "";
  const personal = type === "personal";

  // Число фондов каждого типа при тех же словах и годе: по одному лёгкому запросу (per_page=1), null — счётчик не показываем.
  const count = async (value?: string) => {
    const request = new URLSearchParams({ per_page: "1" });
    for (const key of ["q", "year"]) if (query.get(key)) request.set(key, query.get(key)!);
    if (value) request.set("type", value);
    return (await catalogLoad<List<FundItem>>("funds", request, locale))?.total ?? null;
  };
  const [data, all, ...byType] = await Promise.all([catalogList<List<FundItem>>("funds", query, locale), type ? count() : null, ...TYPES.map(count)]);
  if (!data) return <UnavailableState />;

  const title = personal ? t("tree.personalTitle") : t("tree.fundsTitle");
  const filterCount = ["type", "year"].filter((key) => query.get(key)).length;
  const filtered = filterCount > 0 || Boolean(query.get("q"));
  const options = [
    { value: "", label: t("funds.any"), total: type ? all : data.total },
    ...TYPES.map((value, index) => ({ value, label: t(`fundTypes.${value}`), total: byType[index] })),
  ];
  const row = "flex min-h-11 cursor-pointer items-center gap-3 lg:min-h-9";

  return (
    <>
      <ListHero
        crumbs={[{ label: t("title"), href: "/catalog" }, { label: title }]}
        title={title}
        lead={t("funds.intro")}
        pathname="/catalog/funds"
        formId={FORM}
        formKey={query.toString()}
        formLabel={t("funds.searchLabel")}
        input={{ id: "funds-q", label: t("funds.q"), placeholder: t("funds.qPlaceholder"), value: query.get("q") ?? "" }}
        submit={t("tree.searchSubmit")}
      />
      <div className="container-page space-y-6 pb-16">
        <CatalogNav active={personal ? "personalFunds" : "funds"} />

        <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside aria-labelledby="funds-filters">
            <h2 id="funds-filters" className="sr-only">{t("filters.heading")}</h2>
            {/* На телефоне панель свёрнута: переключатель — чекбокс с подписью, работает без JS. */}
            <input key={`toggle-${query}`} type="checkbox" id="funds-filters-toggle" className="peer sr-only lg:hidden" />
            <label htmlFor="funds-filters-toggle" className="card flex min-h-12 cursor-pointer items-center justify-center gap-2 font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring lg:hidden">
              <SlidersHorizontal className="size-4" aria-hidden />
              {t("filters.toggle", { count: filterCount })}
            </label>
            <div key={query.toString()} className="card mt-3 hidden px-5 pb-5 pt-3 peer-checked:block lg:mt-0 lg:block">
              <fieldset>
                <legend className="flex min-h-11 items-center font-semibold">{t("funds.type")}</legend>
                <ul>
                  {options.map((option) => (
                    <li key={option.value}>
                      <label className={row}>
                        <input form={FORM} type="radio" name="type" value={option.value} defaultChecked={option.value === type} className="size-4 shrink-0 accent-primary" />
                        <span className="min-w-0 flex-1 break-words">{option.label}</span>
                        {option.total !== null && <span className="text-sm tabular-nums text-muted-foreground">{option.total}</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <Field form={FORM} label={t("funds.year")} name="year" type="number" min={1700} max={2100} defaultValue={query.get("year") ?? ""} placeholder="1955" className="mt-3 border-t pt-4 [&>span]:text-base [&>span]:font-semibold" />
              <div className="mt-5 flex flex-wrap gap-2">
                <Button type="submit" form={FORM} className="h-11 px-6">{t("filters.apply")}</Button>
                {filtered && <Button asChild variant="outline" className="h-11"><Link href="/catalog/funds">{t("filters.reset")}</Link></Button>}
              </div>
            </div>
          </aside>

          <section aria-labelledby="funds-results" className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <h2 id="funds-results" aria-live="polite" className="text-xl">{t("results.count", { count: data.total })}</h2>
              <SortSelect
                key={query.toString()}
                form={FORM}
                label={t("sort.label")}
                defaultValue={query.get("sort") ?? ""}
                options={[{ value: "", label: t("funds.sort.relevance") }, ...FUND_SORTS.map((sort) => ({ value: sort, label: t(`funds.sort.${sort}`) }))]}
              />
            </div>
            {data.items.length === 0 ? (
              <div className="space-y-5">
                <div className="card p-6 sm:p-8">
                  <p className="text-xl font-semibold">{t("funds.emptyTitle")}</p>
                  <p className="mt-2 max-w-3xl text-muted-foreground">{t("funds.emptyText")}</p>
                </div>
                <ul className="grid auto-rows-fr gap-4 sm:grid-cols-3">
                  <li><LinkTile href="/catalog/funds" title={t("tree.allFunds")} text={t("empty.funds.text")} /></li>
                  <li><LinkTile href={query.get("q") ? `/search?q=${encodeURIComponent(query.get("q")!)}` : "/search"} title={t("empty.search.label")} text={t("empty.search.text")} /></li>
                  <li><LinkTile href="/assistant" title={t("empty.assistant.label")} text={t("empty.assistant.text")} /></li>
                </ul>
              </div>
            ) : (
              <RecordList>{data.items.map((item) => <FundRow key={item.id} fund={item} />)}</RecordList>
            )}
            <Pagination pathname="/catalog/funds" params={query} page={data.page} pages={data.pages} />
            <p className="max-w-3xl text-sm text-muted-foreground">{t("funds.sourceNote")}</p>
          </section>
        </div>
      </div>
    </>
  );
}
