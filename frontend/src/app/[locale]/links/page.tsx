import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLinkItem } from "@/components/misc/external-link";
import { fetchSiteCounts } from "@/components/misc/api";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { fetchSiteSettings } from "@/lib/api/site-settings";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "misc.links" });
  return { title: t("title"), description: t("intro"), alternates: localizedAlternates(locale, "/links") };
}

/** Адреса — из info/ (akimvko.gov.kz из «Структуры»); Ақорда — официальный домен, в info/ не указан. Пустой адрес = «уточняется». */
const officialLinks: { key: "akorda" | "akimat" | "digitalization" | "veterans"; href?: string }[] = [
  { key: "akorda", href: "https://www.akorda.kz" },
  { key: "akimat", href: "https://akimvko.gov.kz" },
  { key: "digitalization" },
  { key: "veterans" },
];

export default async function LinksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("misc.links");
  const settings = await fetchSiteSettings(locale);
  const usefulLinks = settings?.useful_links ?? [];
  const survey = settings?.survey;
  const counts = await fetchSiteCounts();
  const countItems = (["documents", "funds", "exhibitions"] as const).filter((key) => counts[key] !== null);
  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-10 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
        </header>

        <section aria-labelledby="official-links" className="space-y-4">
          <h2 id="official-links" className="text-xl font-semibold">{t("officialTitle")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {officialLinks.map(({ key, href }) => (
              <ExternalLinkItem key={key} label={t(key)} href={href} />
            ))}
          </ul>
        </section>

        {usefulLinks.length > 0 && (
          <section aria-labelledby="useful-links" className="space-y-4">
            <h2 id="useful-links" className="text-xl font-semibold">{t("usefulTitle")}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {usefulLinks.map((link) => (
                <ExternalLinkItem key={link.url} label={link.title} href={link.url} />
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="site-services" className="space-y-4">
          <h2 id="site-services" className="text-xl font-semibold">{t("servicesTitle")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            <ExternalLinkItem label={t("converter")} />
          </ul>
          <p className="text-sm text-muted-foreground">{t("converterText")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {countItems.length > 0 && (
              <div className="space-y-2 rounded-lg border bg-surface p-4">
                <h3 className="font-medium">{t("stats")}</h3>
                <dl className="grid grid-cols-3 gap-2">
                  {countItems.map((key) => (
                    <div key={key}>
                      <dd className="text-2xl font-bold tabular-nums">{counts[key]}</dd>
                      <dt className="text-sm text-muted-foreground">{t(`counts.${key}`)}</dt>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="space-y-2 rounded-lg border bg-surface p-4">
              <h3 className="font-medium">{t("poll")}</h3>
              {survey?.enabled ? (
                <>
                  <p className="text-sm">{survey.question}</p>
                  {survey.url && (
                    <a href={survey.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                      {t("pollOpen")}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("pollPending")}</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
