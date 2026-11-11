import { Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchPublic } from "@/components/exhibitions/api";
import { safe } from "@/components/misc/api";
import { pageMetadata } from "@/components/misc/metadata";
import { Unavailable } from "@/components/misc/state-help";
import type { NewsList } from "@/components/news/api";
import { NewsCard } from "@/components/news/news-card";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/state-view";
import { TabsNav } from "@/components/ui/tabs-nav";
import { Link } from "@/lib/i18n/navigation";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export const generateMetadata = pageMetadata("news", "/news");

/**
 * Лента новостей: категории ссылками, поиск и порядок по дате, страницы — всё в адресе, работает без скриптов.
 * Карточки идут по две в ряд; при нечётном числе первая становится главной и занимает весь ряд.
 */
export default async function NewsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("news");
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 200);
  const category = first(sp.category).slice(0, 64);
  const sort = first(sp.sort) === "date_asc" ? "date_asc" : "date_desc";
  const page = Math.min(1000, Math.max(1, Number.parseInt(first(sp.page), 10) || 1));

  const result = await safe(fetchPublic<NewsList>("news", new URLSearchParams({ q, category, sort, page: String(page) }), locale));
  if (!result) return <Unavailable />;

  const kept = new URLSearchParams();
  if (q) kept.set("q", q);
  if (category) kept.set("category", category);
  if (sort !== "date_desc") kept.set("sort", sort);
  const filtered = Boolean(q || category);
  const categoryLabel = (value: string) => (t.has(`categories.${value}`) ? t(`categories.${value}`) : value);
  // Ссылка-категория сохраняет запрос и порядок, но сбрасывает страницу.
  const categoryHref = (value: string) => {
    const next = new URLSearchParams(kept);
    if (value) next.set("category", value);
    else next.delete("category");
    const query = next.toString();
    return query ? `/news?${query}` : "/news";
  };
  // Категория из адреса, которой нет в списке API, всё равно показана вкладкой: иначе неясно, что выбрано.
  const categories = category && !result.categories.includes(category) ? [...result.categories, category] : result.categories;

  const lead = result.items.length % 2 === 1 ? result.items[0] : null;
  const rest = lead ? result.items.slice(1) : result.items;

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <div className="container-page space-y-6 pb-16 pt-2">
        <form action={`/${locale}/news`} method="get" role="search" aria-label={t("filter.label")} className="card grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_13rem] lg:grid-cols-[minmax(0,1fr)_14rem_auto] lg:items-end">
          {category && <input type="hidden" name="category" value={category} />}
          <Field name="q" type="search" label={t("filter.q")} defaultValue={q} maxLength={200} />
          <SelectField name="sort" label={t("filter.sort")} defaultValue={sort} options={[{ value: "date_desc", label: t("filter.newest") }, { value: "date_asc", label: t("filter.oldest") }]} />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
            <Button type="submit" className="h-11 px-6"><Search aria-hidden />{t("filter.submit")}</Button>
            {filtered && <Button asChild variant="outline" className="h-11"><Link href="/news">{t("filter.reset")}</Link></Button>}
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <TabsNav
            label={t("categoriesLabel")}
            active={category}
            items={[{ id: "", href: categoryHref(""), label: t("filter.all") }, ...categories.map((value) => ({ id: value, href: categoryHref(value), label: categoryLabel(value) }))]}
          />
          <p id="news-list" className="font-semibold text-muted-foreground">{t("count", { count: result.total })}</p>
        </div>

        <section aria-labelledby="news-list" aria-live="polite">
          {result.items.length > 0 ? (
            <div className="space-y-4">
              {lead && <NewsCard item={lead} locale={locale} lead />}
              <ul className="grid gap-4 lg:auto-rows-fr lg:grid-cols-2">
                {rest.map((item) => (
                  <li key={item.id}><NewsCard item={item} locale={locale} /></li>
                ))}
              </ul>
            </div>
          ) : filtered ? (
            <EmptyState resetHref="/news" as="h2" />
          ) : (
            <p className="card p-6 text-muted-foreground">{t("empty")}</p>
          )}
          <Pagination pathname="/news" params={kept} page={result.page} pages={result.pages} />
        </section>
      </div>
    </>
  );
}
