import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Search } from "lucide-react";
import { api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { PageHead } from "@/components/ui/page-head";
import { EmptyState } from "@/components/ui/empty-state";

export default async function PersonsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  const [t, nav, lang] = await Promise.all([getTranslations("memory"), getTranslations("nav.items"), getLocale()]);
  const res = await api.get<Schema["PersonsResponse"]>("/api/memory/persons", { query: { lang, q }, revalidate: 0 }).catch(() => null);
  const people = [...(res?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name, lang));
  const groups = new Map<string, typeof people>();
  for (const p of people) {
    const k = p.name.trim()[0]?.toUpperCase() ?? "#";
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return (
    <>
      <PageHead title={nav("persons")} crumbs={[{ label: t("title"), href: "/memory" }, { label: nav("persons") }]} actions={
        <form action="" className="relative">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" defaultValue={q} placeholder={t("persons.search")} aria-label={t("persons.search")} className="field !w-72 !rounded-full !pl-11" />
        </form>
      } />
      <div className="wrap">
        {people.length === 0 ? <EmptyState title={t("persons.empty")} /> : (
          // Like a directory: names run in columns, grouped by first letter.
          <div className="columns-1 gap-14 md:columns-2 xl:columns-3">
            {[...groups].map(([letter, list]) => (
              <section key={letter} className="mb-10 break-inside-avoid">
                <h2 aria-hidden className="mb-2 border-b border-line pb-1 font-display text-5xl font-light text-edge-text">{letter}</h2>
                <ul>
                  {list.map((p) => (
                    <li key={p.slug}>
                      <Link href={p.href} className="group -mx-3 block rounded-2xl px-3 py-3 no-underline transition-colors hover:bg-table-2">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="font-display text-2xl font-medium tracking-[-0.025em] group-hover:text-action">{p.name}</span>
                          <span className="tnum shrink-0 text-sm text-ink-3">{p.years_text}</span>
                        </span>
                        {p.bio && <span className="mt-1 block text-sm text-ink-3 line-clamp-2">{p.bio}</span>}
                        {p.is_demo && <span className="mt-1 inline-block"></span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
