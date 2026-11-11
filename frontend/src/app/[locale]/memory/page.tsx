import { getTranslations, setRequestLocale } from "next-intl/server";
import { CollectionCard } from "@/components/memory/collection-card";
import { CollectionFilters } from "@/components/memory/collection-filters";
import { PersonCard } from "@/components/memory/person-card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Link } from "@/lib/i18n/navigation";
import { fetchCollections, fetchPersons } from "@/lib/api/memory";
import { History, MapPinned } from "lucide-react";
import { localizedAlternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "memory" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/memory") };
}

// Направление ТЗ §5.6 -> тема коллекции (если коллекции по нему уже есть).
const directionThemes: Record<number, string> = { 1: "ust-kamenogorsk", 2: "lead-zinc", 4: "education" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function MemoryPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SearchParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const filters = { q: first(sp.q), theme: first(sp.theme), period: first(sp.period) };
  const t = await getTranslations("memory");
  const [collections, persons] = await Promise.all([fetchCollections(locale, filters), fetchPersons(locale)]);
  const available = new Set(collections.themes.map((x) => x.value));
  return (
    <>
      <Breadcrumbs items={[{ label: t("breadcrumb") }]} />
      <div className="container-page space-y-10 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
        </header>

        <section aria-labelledby="dir-title" className="space-y-3">
          <h2 id="dir-title" className="text-xl font-semibold">{t("directions.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("directions.hint")}</p>
          <ul className="flex flex-wrap gap-2">
            {Array.from({ length: 11 }, (_, i) => {
              const theme = directionThemes[i];
              const label = t(`directions.d${i}`);
              return (
                <li key={i}>
                  {theme && available.has(theme) ? (
                    <Link href={`/memory?theme=${theme}`} className="inline-block rounded-full border border-primary bg-surface px-3 py-1.5 text-sm text-primary hover:bg-surface-muted">{label}</Link>
                  ) : (
                    <span className="inline-block rounded-full border px-3 py-1.5 text-sm text-muted-foreground">{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="col-title" className="space-y-4">
          <h2 id="col-title" className="text-2xl font-semibold">{t("collections.title")}</h2>
          <CollectionFilters themes={collections.themes} periods={collections.periods} values={filters} />
          <p role="status" className="text-sm text-muted-foreground">{t("collections.count", { count: collections.items.length })}</p>
          {collections.items.length === 0 ? (
            <p className="rounded-lg border p-4">{t("collections.empty")}</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {collections.items.map((item) => <li key={item.slug}><CollectionCard item={item} /></li>)}
            </ul>
          )}
        </section>

        <section aria-labelledby="per-title" className="space-y-4">
          <h2 id="per-title" className="text-2xl font-semibold">{t("persons.title")}</h2>
          {persons.length === 0 ? (
            <p className="rounded-lg border p-4">{t("persons.empty")}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {persons.map((item) => <li key={item.slug}><PersonCard item={item} /></li>)}
            </ul>
          )}
        </section>

        <section aria-labelledby="more-title" className="space-y-4">
          <h2 id="more-title" className="text-2xl font-semibold">{t("more.title")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/memory/timeline" className="flex gap-3 rounded-lg border bg-surface p-4 hover:bg-surface-muted">
              <History className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
              <span><strong className="block">{t("more.timeline")}</strong><span className="text-sm text-muted-foreground">{t("more.timelineText")}</span></span>
            </Link>
            <Link href="/memory/map" className="flex gap-3 rounded-lg border bg-surface p-4 hover:bg-surface-muted">
              <MapPinned className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
              <span><strong className="block">{t("more.map")}</strong><span className="text-sm text-muted-foreground">{t("more.mapText")}</span></span>
            </Link>
          </div>
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("more.soon")}</p>
        </section>
      </div>
    </>
  );
}
