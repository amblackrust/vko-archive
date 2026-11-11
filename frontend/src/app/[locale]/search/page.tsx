import { getTranslations, setRequestLocale } from "next-intl/server";
import { FilterChip } from "@/components/catalog/filter-chip";
import { ListHero } from "@/components/catalog/list-hero";
import { AiAnswer } from "@/components/search/ai-answer";
import { DOC_FILTERS, filterLabel, tabHref } from "@/components/search/filters";
import { ResultRow } from "@/components/search/result-row";
import { Button } from "@/components/ui/button";
import { LinkTile } from "@/components/ui/link-tile";
import { Pagination } from "@/components/ui/pagination";
import { RecordList } from "@/components/ui/record-list";
import { UnavailableState } from "@/components/ui/state-view";
import { TabsNav } from "@/components/ui/tabs-nav";
import { withoutParam, withQuery, type SearchParams } from "@/lib/api/catalog";
import { fetchSearch, SEARCH_TYPES } from "@/lib/api/search";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

/** Сколько результатов каждого типа на вкладке «Все» и на вкладке одного типа. */
const PER_GROUP = 5;
const PER_PAGE = 20;
/** Предел смещения в /api/search. */
const MAX_OFFSET = 1000;
/** Запросы-примеры под строкой поиска (search.start.examples.*): по каждому в каталоге есть записи. */
const EXAMPLES = ["a", "b", "c", "d"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return { title: t("title"), description: t("lead"), alternates: localizedAlternates(locale, "/search") };
}

/**
 * Единый поиск. Результаты приходят из /api/search при рендере страницы и не ждут модель;
 * вкладка типа, фильтры документов и страница живут в адресе. Ответ помощника — отдельный блок рядом.
 */
export default async function SearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("search");
  const tc = await getTranslations("catalog");
  const ts = await getTranslations("states");
  const raw = await searchParams;
  const one = (key: string) => [raw[key]].flat()[0]?.trim() ?? "";
  const q = one("q").slice(0, 500);
  const type = SEARCH_TYPES.find((value) => value === one("type")) ?? null;
  const page = Math.min(Math.max(Math.floor(Number(one("page"))) || 1, 1), MAX_OFFSET / PER_PAGE + 1);

  // current — условия без номера страницы: из них строятся все ссылки. Фильтры документов действуют только на вкладке «Документы».
  const current = new URLSearchParams(q ? { q } : {});
  if (type) current.set("type", type);
  if (type === "document") for (const key of DOC_FILTERS) for (const value of [raw[key]].flat()) if (value) current.append(key, value);
  const filtered = DOC_FILTERS.some((key) => current.has(key));

  const request = new URLSearchParams(current);
  request.delete("type");
  request.set("lang", locale);
  if (type) request.set("types", type);
  request.set("per_group", String(type ? PER_PAGE : PER_GROUP));
  request.set("offset", String(type ? (page - 1) * PER_PAGE : 0));
  // В журнал запросов попадает только первый показ выдачи, а не листание и вкладки.
  if (type || filtered) request.set("log", "false");
  // Счётчики вкладок считаются без фильтров документов, иначе остальные вкладки пропали бы.
  const counts = new URLSearchParams({ q, lang: locale, per_group: "1", log: "false" });
  const [data, unfiltered] = q ? await Promise.all([fetchSearch(request), filtered ? fetchSearch(counts) : null]) : [null, null];
  if (q && !data) return <UnavailableState />;

  const facets = (unfiltered ?? data)?.facets.type ?? [];
  const total = facets.reduce((sum, facet) => sum + facet.count, 0);
  const tabs = SEARCH_TYPES.filter((value) => value === type || facets.some((facet) => facet.value === value));
  const shown = data?.groups.reduce((sum, group) => sum + group.total, 0) ?? 0;
  // Куда идти дальше — равными плитками: на пустой странице поиска и когда ничего не найдено.
  const steps = (
    <ul className="grid auto-rows-fr gap-4 sm:grid-cols-3">
      <li><LinkTile href={withQuery("/catalog", new URLSearchParams(q && q.length <= 200 ? { q } : {}))} title={t("next.catalog.label")} text={t("next.catalog.text")} /></li>
      <li><LinkTile href="/catalog/funds" title={t("next.funds.label")} text={t("next.funds.text")} /></li>
      <li><LinkTile href="/assistant" title={t("next.assistant.label")} text={t("next.assistant.text")} /></li>
    </ul>
  );

  return (
    <>
      <ListHero
        crumbs={[{ label: t("title") }]}
        title={t("title")}
        lead={q ? undefined : t("lead")}
        pathname="/search"
        formKey={q}
        formLabel={t("label")}
        input={{ id: "search-q", label: t("label"), placeholder: t("placeholder"), value: q, maxLength: 500 }}
        submit={t("submit")}
      >
        {!q && (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("start.examplesLabel")}</span>
            {EXAMPLES.map((id) => (
              <Link key={id} href={`/search?q=${encodeURIComponent(t(`start.examples.${id}`))}`} className="rounded-full bg-primary-soft px-3.5 py-1.5 font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
                {t(`start.examples.${id}`)}
              </Link>
            ))}
          </p>
        )}
      </ListHero>

      {!data ? (
        <section aria-labelledby="search-start" className="container-page space-y-6 pb-16 pt-4">
          <div className="max-w-3xl">
            <h2 id="search-start" className="text-2xl sm:text-3xl">{t("start.title")}</h2>
            <p className="mt-2 text-muted-foreground">{t("start.text")}</p>
          </div>
          {steps}
        </section>
      ) : (
        <div className="container-page grid grid-cols-1 items-start gap-x-8 gap-y-6 pb-16 lg:grid-cols-[minmax(0,1fr)_23rem]">
          {total > 0 && (
            <TabsNav
              label={t("tabs.label")}
              active={type ?? "all"}
              items={[
                { id: "all", href: tabHref(current, null), label: t("tabs.all"), count: total },
                ...tabs.map((value) => ({ id: value, href: tabHref(current, value), label: t(`types.${value}`), count: facets.find((facet) => facet.value === value)?.count ?? 0 })),
              ]}
            />
          )}
          {/* Когда ничего не найдено, на телефоне сначала идёт это сообщение и следующие шаги, а блок помощника — после них. */}
          <aside className={cn("lg:col-start-2 lg:row-span-2 lg:row-start-1", shown === 0 && "max-lg:order-last")}>
            <AiAnswer key={q} query={q} current={current.toString()} />
          </aside>

          <section aria-labelledby="search-results" className="min-w-0 space-y-8 lg:col-start-1">
            {shown === 0 ? (
              <div className="space-y-5">
                <div className="card p-6 sm:p-8">
                  <h2 id="search-results" aria-live="polite" className="text-2xl sm:text-3xl">{ts("empty.title")}</h2>
                  <p className="mt-2 max-w-2xl text-muted-foreground">{ts("empty.description")}</p>
                  {(filtered || type) && <Button asChild variant="outline" className="mt-5"><Link href={tabHref(current, null)}>{ts("empty.reset")}</Link></Button>}
                </div>
                {steps}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <p id="search-results" aria-live="polite" className="text-xl font-semibold">{t("found", { query: q, count: shown })}</p>
                  {!data.semantic && <p className="text-sm text-muted-foreground">{t("noVector")}</p>}
                  {filtered && (
                    <ul aria-label={t("filters.label")} className="flex flex-wrap items-center gap-2">
                      {DOC_FILTERS.flatMap((key) =>
                        current.getAll(key).map((value) => {
                          const label = filterLabel(t, tc, key, value);
                          return (
                            <li key={`${key}=${value}`}>
                              <FilterChip href={withQuery("/search", withoutParam(current, key, value))} label={label} hint={t("filters.remove", { name: label })} />
                            </li>
                          );
                        }),
                      )}
                    </ul>
                  )}
                </div>
                {data.groups.map((group) => (
                  <section key={group.type} aria-labelledby={`found-${group.type}`} className="space-y-4">
                    <div className={type ? "sr-only" : "flex flex-wrap items-end justify-between gap-x-6 gap-y-2"}>
                      <h2 id={`found-${group.type}`} className="flex items-baseline gap-3 text-2xl sm:text-3xl">
                        {t(`types.${group.type}`)}
                        <span className="text-base font-normal tabular-nums text-muted-foreground">{group.total}</span>
                      </h2>
                      {!type && group.total > group.items.length && (
                        <Link href={tabHref(current, group.type)} className="inline-flex min-h-10 items-center rounded-md bg-primary-soft px-4 text-[0.9375rem] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
                          {t("allOfType", { type: t(`types.${group.type}`), count: group.total })}
                        </Link>
                      )}
                    </div>
                    <RecordList>{group.items.map((item) => <ResultRow key={item.id} item={item} />)}</RecordList>
                  </section>
                ))}
              </>
            )}
            {type && <Pagination pathname="/search" params={current} page={page} pages={Math.min(Math.ceil(shown / PER_PAGE), MAX_OFFSET / PER_PAGE + 1)} />}
          </section>
        </div>
      )}
    </>
  );
}
