import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchPublic } from "@/components/exhibitions/api";
import { safe } from "@/components/misc/api";
import { pageMetadata } from "@/components/misc/metadata";
import { Unavailable } from "@/components/misc/state-help";
import type { NewsList } from "@/components/news/api";
import { NewsRow } from "@/components/news/news-row";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/state-view";
import { Link } from "@/lib/i18n/navigation";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export const generateMetadata = pageMetadata("news", "/news");

/** Лента новостей: поиск, категория, порядок по дате и страницы — всё в адресе, работает без скриптов. */
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

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <div className="container-page space-y-8 py-8 pb-16">
        <form action={`/${locale}/news`} method="get" role="search" aria-label={t("filter.label")} className="grid gap-4 card p-5 md:grid-cols-2 lg:grid-cols-[1fr_13rem_12rem_auto] lg:items-end">
          <Field name="q" type="search" label={t("filter.q")} defaultValue={q} maxLength={200} />
          <SelectField name="category" label={t("filter.category")} defaultValue={category} options={[{ value: "", label: t("filter.all") }, ...result.categories.map((value) => ({ value, label: categoryLabel(value) }))]} />
          <SelectField name="sort" label={t("filter.sort")} defaultValue={sort} options={[{ value: "date_desc", label: t("filter.newest") }, { value: "date_asc", label: t("filter.oldest") }]} />
          <div className="flex gap-2">
            <Button type="submit" className="h-11 px-6">{t("filter.submit")}</Button>
            {filtered && <Button asChild variant="outline" className="h-11"><Link href="/news">{t("filter.reset")}</Link></Button>}
          </div>
        </form>

        <section aria-labelledby="news-list" aria-live="polite">
          <p id="news-list" className="font-semibold">{t("count", { count: result.total })}</p>
          {result.items.length > 0 ? (
            <ul className="card mt-4 divide-y px-5 sm:px-6">
              {result.items.map((item) => <NewsRow key={item.id} item={item} locale={locale} />)}
            </ul>
          ) : filtered ? (
            <EmptyState resetHref="/news" as="h2" />
          ) : (
            <p className="card mt-4 max-w-2xl p-6 text-muted-foreground">{t("empty")}</p>
          )}
          <Pagination pathname="/news" params={kept} page={result.page} pages={result.pages} />
        </section>
      </div>
    </>
  );
}
