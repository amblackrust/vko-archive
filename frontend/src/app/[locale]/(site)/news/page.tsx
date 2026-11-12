import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { pageMeta } from "@/lib/seo";
import { Search } from "lucide-react";
import clsx from "clsx";
import { api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { PageHead } from "@/components/ui/page-head";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";

type SP = { category?: string; q?: string; sort?: string; page?: string };
const CATS = ["site", "exhibitions", "branches", "events", "memory"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, c] = await Promise.all([getTranslations({ locale, namespace: "news" }), getTranslations({ locale, namespace: "common" })]);
  return pageMeta({ locale, path: "/news", title: t("title"), description: c("siteName") });
}

export default async function NewsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const [t, lang, format] = await Promise.all([getTranslations("news"), getLocale(), getFormatter()]);
  const res = await api.get<Schema["NewsList"]>("/api/news", { query: { lang, category: sp.category, q: sp.q, sort: sp.sort, page: sp.page, per_page: 12 }, revalidate: 0 }).catch(() => null);
  const href = (patch: Partial<SP>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch, page: undefined })) if (v) s.set(k, v as string);
    return `/news${s.toString() ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) => clsx("inline-flex h-10 items-center rounded-full px-4 no-underline transition-colors", on ? "bg-ink text-table" : "bg-table-3 text-ink-2 hover:text-ink");
  const items = res?.items ?? [];
  const date = (v: string | null) => (v ? format.dateTime(new Date(v), { day: "numeric", month: "long", year: "numeric" }) : "");

  return (
    <>
      <PageHead title={t("title")} actions={
        <form action="" className="relative">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" defaultValue={sp.q} placeholder={t("search")} aria-label={t("search")} className="field !w-72 !rounded-full !pl-11" />
          {sp.category && <input type="hidden" name="category" value={sp.category} />}
        </form>
      } />
      <div className="wrap mb-8 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label={t("title")}>
          <Link href={href({ category: undefined })} className={chip(!sp.category)}>{t("categories.all")}</Link>
          {CATS.map((c) => <Link key={c} href={href({ category: c })} className={chip(sp.category === c)}>{t(`categories.${c}`)}</Link>)}
        </nav>
        <nav className="flex gap-2 text-sm">
          <Link href={href({ sort: undefined })} className={chip(!sp.sort || sp.sort === "new")}>{t("sort.new")}</Link>
          <Link href={href({ sort: "old" })} className={chip(sp.sort === "old")}>{t("sort.old")}</Link>
        </nav>
      </div>
      <div className="wrap">
        {items.length === 0 ? <EmptyState title={t("empty")} /> : (
          // Sheets of different weight fall into columns, newest first.
          <ul className="columns-1 gap-6 md:columns-2 xl:columns-3 [&>li]:mb-6 [&>li]:break-inside-avoid">
            {items.map((n, i) => (
              <li key={n.id}>
                <Link href={n.href} className={clsx("group block rounded-[22px] border border-line bg-panel p-7 no-underline shadow-lift transition-[transform,box-shadow] duration-300 ease-(--ease-spring) hover:-translate-y-1.5 hover:shadow-lift-high", i === 0 && "md:p-10")}>
                  <span className="flex items-center gap-2"><time dateTime={n.published_at ?? undefined} className="edge">{date(n.published_at)}</time></span>
                  <span className={clsx("mt-3 block font-display font-medium tracking-[-0.03em] transition-colors group-hover:text-action", i === 0 ? "text-4xl md:text-5xl" : i % 3 === 1 ? "text-3xl" : "text-2xl")}>{n.title}</span>
                  {n.summary && <span className="mt-3 block text-ink-2">{n.summary}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {res && <Pagination page={res.page} pages={res.pages} basePath="/news" params={sp} />}
      </div>
    </>
  );
}
