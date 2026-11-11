import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchPublic, type ExhibitionList } from "@/components/exhibitions/api";
import { ExhibitionCard } from "@/components/exhibitions/exhibition-card";
import { FilterForm, filterValues } from "@/components/memory/filter-form";
import { themeLabel } from "@/components/memory/labels";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, UnavailableState } from "@/components/ui/state-view";
import { attempt } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "exhibitions" });
  return { title: t("title"), description: t("intro"), alternates: localizedAlternates(locale, "/exhibitions") };
}

export default async function ExhibitionsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("exhibitions");
  const filters = filterValues(await searchParams);
  const filtered = Boolean(filters.q || filters.theme || filters.period);
  const result = await attempt(fetchPublic<ExhibitionList>("exhibitions", new URLSearchParams(filters), locale));
  if (!result) return <UnavailableState />;

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("intro")} />
      <div className="container-page space-y-6 py-6 pb-16">
        <FilterForm
          path="/exhibitions"
          label={t("filter.label")}
          values={filters}
          themes={result.themes.map((value) => ({ value, label: themeLabel(t, "themes", value) }))}
          periods={result.periods.map((value) => ({ value, label: value }))}
          text={{ q: t("filter.q"), theme: t("filter.theme"), period: t("filter.period"), all: t("filter.all"), submit: t("filter.submit"), reset: t("filter.reset") }}
        />
        {result.items.length > 0 ? (
          <section aria-labelledby="exhibitions-found" className="space-y-4">
            <h2 id="exhibitions-found" className="text-base font-semibold">{t("count", { count: result.total })}</h2>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((exhibition) => (
                <li key={exhibition.id}><ExhibitionCard exhibition={exhibition} locale={locale} heading="h3" /></li>
              ))}
            </ul>
          </section>
        ) : filtered ? (
          <EmptyState resetHref="/exhibitions" as="h2" />
        ) : (
          <div className="card max-w-2xl space-y-4 p-6">
            <h2 className="text-lg">{t("empty.title")}</h2>
            <p className="text-muted-foreground">{t("empty.text")}</p>
            <Button asChild variant="outline"><Link href="/memory">{t("empty.memory")}</Link></Button>
          </div>
        )}
      </div>
    </>
  );
}
