import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ExternalServiceLinks } from "@/components/services/external-links";
import { InfoNotice } from "@/components/services/info-notice";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services.state" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/services/state") };
}

/** Информационный раздел госуслуги: нормативная основа и внешние каналы. Заявления здесь не принимаются. */
export default async function StateServicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services.state");
  const tc = await getTranslations("services");

  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-8 pb-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
        </header>
        <InfoNotice>{tc("state.notice")}</InfoNotice>

        <section aria-labelledby="state-law" className="space-y-3">
          <h2 id="state-law" className="text-xl font-semibold">{t("lawsHeading")}</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>{t("law")}</li>
            <li>{t("rules")}</li>
          </ul>
        </section>

        <section aria-labelledby="state-details" className="space-y-3 rounded-lg border bg-surface-muted p-5">
          <h2 id="state-details" className="flex flex-wrap items-center gap-3 text-xl font-semibold">
            {t("detailsHeading")}
            <DemoBadge kind="badge" />
          </h2>
          <p>{t("detailsPending")}</p>
        </section>

        <section aria-labelledby="state-reports" className="space-y-3">
          <h2 id="state-reports" className="text-xl font-semibold">{t("reportsHeading")}</h2>
          <p>{t("reportsPending")}</p>
        </section>

        <section aria-labelledby="state-contacts" className="space-y-3">
          <h2 id="state-contacts" className="text-xl font-semibold">{t("contactsHeading")}</h2>
          <p>
            {t("contactsText")}{" "}
            <Link href="/contacts" className="text-primary underline underline-offset-2">{t("contactsLink")}</Link>
          </p>
        </section>

        <section aria-labelledby="state-external" className="space-y-3">
          <h2 id="state-external" className="text-xl font-semibold">{tc("external.heading")}</h2>
          <ExternalServiceLinks />
        </section>
      </div>
    </>
  );
}
