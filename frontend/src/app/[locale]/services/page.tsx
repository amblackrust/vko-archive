import { getTranslations, setRequestLocale } from "next-intl/server";
import { safe } from "@/components/misc/api";
import { PageSection, PageStack } from "@/components/misc/blocks";
import { pageMetadata } from "@/components/misc/metadata";
import { ExternalServiceLinks } from "@/components/services/external-links";
import { OfficeStrip } from "@/components/services/office";
import { ServiceTile } from "@/components/services/service-tile";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { fetchContacts, receptionPhone } from "@/lib/api/content";

const ROUTES = [
  { id: "certificate", href: "/services/state" },
  { id: "navigator", href: "/navigator" },
  { id: "paid", href: "/services/paid" },
  { id: "readingRoom", href: "/help/reading-room" },
  { id: "legal", href: "/legal" },
  { id: "compliance", href: "/compliance" },
] as const;

const PORTALS = ["egov", "eotinish", "adilet"] as const;

export const generateMetadata = pageMetadata("services.index", "/services");

/** Входная страница раздела услуг: плитки услуг, государственные порталы и канцелярия. Сам сайт заявлений и оплаты не принимает. */
export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services.index");
  const contacts = await safe(fetchContacts());
  const reception = receptionPhone(contacts);

  return (
    <>
      <PageHeader tone="brand" crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageStack>
        <PageSection id="routes" title={t("routes.title")}>
          <ul className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
            {ROUTES.map(({ id, href }) => (
              <li key={id}>
                <ServiceTile href={href} title={t(`routes.${id}.title`)} text={t(`routes.${id}.text`)} where={t(`routes.${id}.where`)} />
              </li>
            ))}
          </ul>
        </PageSection>

        <PageSection id="external" title={t("external.title")} text={t("external.text")}>
          <div className="space-y-4">
            <Notice tone="warning" title={t("notice.title")}>{t("notice.text")}</Notice>
            <ExternalServiceLinks ids={PORTALS} />
          </div>
        </PageSection>

        {contacts && (
          <PageSection id="office" title={t("office.title")} link={{ href: "/contacts", label: t("office.link") }}>
            <OfficeStrip contacts={contacts} reception={reception} labels={{ phone: t("office.phone"), hours: t("office.hours"), address: t("office.address") }} />
          </PageSection>
        )}
      </PageStack>
    </>
  );
}
