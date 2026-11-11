import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TranslationNote } from "@/components/help/translation-note";
import { ActRow } from "@/components/legal/act-row";
import { legalFetch, type CompliancePage as ComplianceData } from "@/components/legal/api";
import { safe } from "@/components/misc/api";
import { PhoneLink } from "@/components/misc/contact-links";
import { pageMetadata } from "@/components/misc/metadata";
import { Block, PageBody, SeeAlso } from "@/components/misc/page-layout";
import { RichText } from "@/components/misc/rich-text";
import { Unavailable } from "@/components/misc/state-help";
import { ExternalServiceLinks } from "@/components/services/external-links";
import { FactList } from "@/components/ui/facts";
import { PageHeader } from "@/components/ui/page-header";
import { RecordList } from "@/components/ui/record-list";
import { fetchContacts, receptionPhone } from "@/lib/api/content";

export const generateMetadata = pageMetadata("compliance", "/compliance");

/** Комплаенс-служба: офицер, сведения о работе службы и её открытые документы из API. */
export default async function CompliancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("compliance");
  const [page, contacts] = await Promise.all([
    legalFetch<ComplianceData>("compliance", new URLSearchParams(), locale).catch(() => undefined),
    safe(fetchContacts()),
  ]);
  if (page === undefined) return <Unavailable />;
  if (!page) notFound();
  // Телефон комплаенс-офицера заказчик не передал: даём приёмную архива.
  const reception = receptionPhone(contacts);

  return (
    <>
      <PageHeader crumbs={[{ label: page.title }]} title={page.title} titleLang={page.title_lang} lead={t("lead")} />
      <PageBody
        aside={
          <>
            <FactList
              items={[
                { label: t("officer"), value: page.officer ? <span lang="ru">{page.officer}</span> : <span className="font-normal text-muted-foreground">{t("officerMissing")}</span> },
                {
                  label: t("phone"),
                  value: (
                    <>
                      <span className="block text-sm font-normal text-muted-foreground">{t("phoneMissing")}</span>
                      {reception && <PhoneLink value={reception} className="mt-1" />}
                    </>
                  ),
                },
              ]}
            />
            <SeeAlso
              title={t("more.title")}
              items={[
                { href: "/legal", label: t("more.legal") },
                { href: "/services/paid", label: t("more.paid") },
                { href: "/contacts", label: t("more.contacts") },
              ]}
            />
          </>
        }
      >
        <Block id="about" title={t("about")}>
          <TranslationNote requested={locale} actual={page.body_lang} />
          <RichText html={page.body} lang={page.body_lang} />
        </Block>

        <Block id="documents" title={t("documents.title")} text={t("documents.text")}>
          {page.documents.length === 0 ? (
            <p className="text-muted-foreground">{t("documents.empty")}</p>
          ) : (
            <RecordList>{page.documents.map((act) => <ActRow key={act.id} act={act} locale={locale} status={false} />)}</RecordList>
          )}
        </Block>

        <Block id="report" title={t("report.title")} text={t("report.text")}>
          <ExternalServiceLinks only="eotinish" />
        </Block>
      </PageBody>
    </>
  );
}
