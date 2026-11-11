import { getTranslations, setRequestLocale } from "next-intl/server";
import { safe } from "@/components/misc/api";
import { PhoneLink } from "@/components/misc/contact-links";
import { pageMetadata } from "@/components/misc/metadata";
import { Block, PageBody } from "@/components/misc/page-layout";
import { ExternalServiceLinks } from "@/components/services/external-links";
import { FactList } from "@/components/ui/facts";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { RecordList, RecordRow } from "@/components/ui/record-list";
import { fetchContacts, receptionPhone } from "@/lib/api/content";
import { Link } from "@/lib/i18n/navigation";

const ROUTES = [
  { id: "certificate", href: "/services/state" },
  { id: "paid", href: "/services/paid" },
  { id: "readingRoom", href: "/help/reading-room" },
  { id: "legal", href: "/legal" },
  { id: "compliance", href: "/compliance" },
] as const;

export const generateMetadata = pageMetadata("services.index", "/services");

/** Входная страница раздела услуг: что можно сделать и где это оформляется. Сам сайт заявлений и оплаты не принимает. */
export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services.index");
  const contacts = await safe(fetchContacts());
  const reception = receptionPhone(contacts);

  return (
    <>
      <PageHeader tone="brand" crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageBody
        aside={
          <section aria-labelledby="services-office">
            <h2 id="services-office" className="mb-3 text-base">{t("office.title")}</h2>
            <FactList
              items={[
                { label: t("office.phone"), value: reception && <PhoneLink value={reception} /> },
                { label: t("office.hours"), value: contacts && <span lang="ru">{contacts.hours}</span> },
                { label: t("office.address"), value: contacts && <span lang="ru">{contacts.address}</span> },
              ]}
            />
            <p className="mt-3"><Link href="/contacts" className="text-link font-medium">{t("office.link")}</Link></p>
          </section>
        }
      >
        <Notice tone="warning" title={t("notice.title")}>{t("notice.text")}</Notice>

        <Block id="routes" title={t("routes.title")}>
          <RecordList>
            {ROUTES.map(({ id, href }) => (
              <RecordRow
                key={id}
                heading="h3"
                title={t(`routes.${id}.title`)}
                href={href}
                aside={<span className="max-w-[14rem] font-medium">{t(`routes.${id}.where`)}</span>}
              >
                <p className="mt-1 max-w-2xl text-[0.9375rem] text-muted-foreground">{t(`routes.${id}.text`)}</p>
              </RecordRow>
            ))}
          </RecordList>
        </Block>

        <Block id="external" title={t("external.title")} text={t("external.text")}>
          <ExternalServiceLinks />
        </Block>
      </PageBody>
    </>
  );
}
