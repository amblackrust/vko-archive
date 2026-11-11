import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { InfoNotice } from "@/components/services/info-notice";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services.paid" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/services/paid") };
}

/** Справочные сведения о платных услугах. Прейскурант не загружен в каталог: показываем, где его уточнить. */
export default async function PaidServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services.paid");

  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-8 pb-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
        </header>
        <InfoNotice>{t("notice")}</InfoNotice>

        <section aria-labelledby="paid-resolution" className="space-y-3">
          <h2 id="paid-resolution" className="text-xl font-semibold">{t("resolutionHeading")}</h2>
          <p className="rounded-lg border bg-surface p-4">{t("resolution")}</p>
          <p className="text-sm text-muted-foreground">{t("requisitesPending")}</p>
        </section>

        <section aria-labelledby="paid-price" className="space-y-3 rounded-lg border bg-surface-muted p-5">
          <h2 id="paid-price" className="flex flex-wrap items-center gap-3 text-xl font-semibold">
            {t("priceHeading")}
            <DemoBadge kind="badge" />
          </h2>
          <p>
            {t("pricePending")}{" "}
            <Link href="/contacts" className="text-primary underline underline-offset-2">{t("contactsLink")}</Link>
          </p>
        </section>
      </div>
    </>
  );
}
