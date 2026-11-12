import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { PageHead } from "@/components/ui/page-head";
import { EmptyState } from "@/components/ui/empty-state";

export default async function CollectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nav, lang] = await Promise.all([getTranslations("memory"), getTranslations("nav.items"), getLocale()]);
  const res = await api.get<Schema["CollectionsResponse"]>("/api/memory/collections", { query: { lang } }).catch(() => null);
  const items = res?.items ?? [];
  return (
    <>
      <PageHead title={nav("memoryCollections")} crumbs={[{ label: t("title"), href: "/memory" }, { label: nav("memoryCollections") }]} />
      <div className="wrap">
        {items.length === 0 ? <EmptyState title="—" /> : (
          // A table of contents in large type; the line draws under the title on hover.
          <ol>
            {items.map((c, i) => (
              <li key={c.slug} className="border-t border-line last:border-b">
                <Link href={c.href} className="group grid grid-cols-[3rem_1fr] items-baseline gap-x-6 gap-y-2 py-7 no-underline md:grid-cols-[4rem_minmax(0,1fr)_14rem] md:py-9">
                  <span className="tnum edge">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="inline bg-gradient-to-r from-action to-action bg-[length:0%_3px] bg-left-bottom bg-no-repeat pb-1 font-display text-[clamp(2rem,5vw,4rem)] font-semibold leading-[1.1] tracking-[-0.04em] transition-[background-size] duration-500 ease-(--ease-out) group-hover:bg-[length:100%_3px]">{c.title}</span>
                    {c.description && <span className="mt-3 block max-w-[60ch] text-ink-2 line-clamp-2">{c.description}</span>}
                  </span>
                  <span className="col-start-2 flex items-center gap-3 text-sm text-ink-3 md:col-start-3 md:justify-end">
                    <span>{c.period}</span><span className="tnum">{t("items", { count: c.item_count })}</span><ArrowUpRight size={18} className="hidden md:block" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
