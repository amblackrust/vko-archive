import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { fetchPublic, type ExhibitionList } from "@/components/exhibitions/api";
import { ExhibitionCard } from "@/components/exhibitions/exhibition-card";
import { ExhibitionFilter } from "@/components/exhibitions/exhibition-filter";
import { EmptyState, UnavailableState } from "@/components/ui/state-view";
import { localizedAlternates } from "@/lib/seo";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "exhibitions" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/exhibitions") };
}

export default async function ExhibitionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("exhibitions");
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 200);
  const theme = first(sp.theme).slice(0, 128);
  const period = first(sp.period).slice(0, 64);

  let result: ExhibitionList | null = null;
  try {
    result = await fetchPublic<ExhibitionList>("exhibitions", new URLSearchParams({ q, theme, period }), locale);
  } catch {
    result = null;
  }

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
            <ExhibitionFilter q={q} theme={theme} period={period} themes={result.themes} periods={result.periods} />
            {result.items.length === 0 ? (
              <EmptyState resetHref="/exhibitions" as="h2" />
            ) : (
              <section aria-live="polite" className="space-y-4">
                <p className="font-medium">{t("count", { count: result.total })}</p>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {result.items.map((exhibition) => (
                    <li key={exhibition.id}>
                      <ExhibitionCard exhibition={exhibition} locale={locale} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
