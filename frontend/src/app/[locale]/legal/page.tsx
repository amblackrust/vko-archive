import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalActCard } from "@/components/legal/act-card";
import { LegalActFilter } from "@/components/legal/act-filter";
import { legalFetch, LEGAL_STATUSES, type LegalActsResponse } from "@/components/legal/api";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { EmptyState, UnavailableState } from "@/components/ui/state-view";
import { localizedAlternates } from "@/lib/seo";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/legal") };
}

/** Нормативные акты из каталога (опубликованные) и перечень из ТЗ, который в каталог ещё не загружен. */
export default async function LegalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 200);
  const statusParam = first(sp.status);
  const status = (LEGAL_STATUSES as readonly string[]).includes(statusParam) ? statusParam : "";

  const query = new URLSearchParams({ q });
  if (status) query.set("status", status);

  let result: LegalActsResponse | null = null;
  let unavailable = false;
  try {
    result = await legalFetch<LegalActsResponse>("legal-acts", query, locale);
  } catch {
    unavailable = true;
  }
  const reference = t.raw("reference.items") as string[];

  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-8 pb-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
        </header>

        <LegalActFilter q={q} status={status} />

        {unavailable || result === null ? (
          <UnavailableState />
        ) : result.items.length === 0 ? (
          <EmptyState resetHref="/legal" as="h2" />
        ) : (
          <section aria-live="polite" className="space-y-4">
            <p className="font-medium">{t("count", { count: result.total })}</p>
            <ul className="space-y-3">
              {result.items.map((act) => (
                <li key={act.id}>
                  <LegalActCard act={act} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="legal-reference" className="space-y-3 rounded-lg border bg-surface-muted p-5">
          <h2 id="legal-reference" className="text-xl font-semibold">{t("reference.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("reference.intro")}</p>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {reference.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-sm">
            <a href="https://adilet.zan.kz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {t("adiletLink")}
            </a>
          </p>
        </section>
      </div>
    </>
  );
}
