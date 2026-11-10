import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLinkItem } from "@/components/misc/external-link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
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

        <section aria-labelledby="site-services" className="space-y-4">
          <h2 id="site-services" className="text-xl font-semibold">{t("servicesTitle")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            <ExternalLinkItem label={t("converter")} />
          </ul>
          <p className="text-sm text-muted-foreground">{t("converterText")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["rating", "stats", "poll"] as const).map((key) => (
              <div key={key} className="space-y-2 rounded-lg border bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">{t(key)}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{t(`${key}Pending`)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
