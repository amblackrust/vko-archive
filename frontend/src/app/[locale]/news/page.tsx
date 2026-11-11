import { getTranslations, setRequestLocale } from "next-intl/server";
import { Pagination } from "@/components/catalog/pagination";
import { fetchPublic } from "@/components/exhibitions/api";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import type { NewsList } from "@/components/news/api";
import { NewsCard } from "@/components/news/news-card";
import { NewsFilter } from "@/components/news/news-filter";
import { EmptyState, UnavailableState } from "@/components/ui/state-view";
import { localizedAlternates } from "@/lib/seo";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "news" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/news") };
}

export default async function NewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("news");
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 200);
  const category = first(sp.category).slice(0, 64);
  const sort = first(sp.sort) === "date_asc" ? "date_asc" : "date_desc";
  const page = /^\d{1,4}$/.test(first(sp.page)) ? Math.max(1, Number(first(sp.page))) : 1;

  let result: NewsList | null = null;
  try {
    result = await fetchPublic<NewsList>("news", new URLSearchParams({ q, category, sort, page: String(page) }), locale);
  } catch {
    result = null;
  }

  const kept = new URLSearchParams();
  if (q) kept.set("q", q);
  if (category) kept.set("category", category);
  if (sort !== "date_desc") kept.set("sort", sort);

  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
        </header>
        {result === null ? (
          <UnavailableState />
        ) : (
          <>
            <NewsFilter q={q} category={category} sort={sort} categories={result.categories} />
            {result.items.length === 0 ? (
              <EmptyState resetHref="/news" as="h2" />
            ) : (
              <section aria-live="polite" className="space-y-4">
                <p className="font-medium">{t("count", { count: result.total })}</p>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {result.items.map((item) => (
                    <li key={item.id}>
                      <NewsCard item={item} locale={locale} />
                    </li>
                  ))}
                </ul>
                <Pagination pathname="/news" params={kept} page={result.page} pages={result.pages} />
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
