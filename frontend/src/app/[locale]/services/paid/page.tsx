import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActRow } from "@/components/legal/act-row";
import { legalFetch, type LegalActsResponse } from "@/components/legal/api";
import { safe } from "@/components/misc/api";
import { MailLink, PhoneLink } from "@/components/misc/contact-links";
import { pageMetadata } from "@/components/misc/metadata";
import { Block, PageBody, SeeAlso } from "@/components/misc/page-layout";
import { PriceTable } from "@/components/services/price-table";
import { FactList } from "@/components/ui/facts";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { RecordList } from "@/components/ui/record-list";
import { fetchContacts, receptionPhone } from "@/lib/api/content";
import { Link } from "@/lib/i18n/navigation";

export const generateMetadata = pageMetadata("services.paid", "/services/paid");

/**
 * Платные услуги — только справка. Постановление об утверждении прейскуранта и сам прейскурант заказчик
 * не передал: страница говорит об этом прямо и не показывает цен. Постановление появится здесь само,
 * когда его внесут в перечень актов (поиск по слову «прейскурант»).
 */
export default async function PaidServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services.paid");
  const section = await getTranslations("services.index");
  const [acts, contacts] = await Promise.all([
    safe(legalFetch<LegalActsResponse>("legal-acts", new URLSearchParams({ q: "прейскурант" }), locale)),
    safe(fetchContacts()),
  ]);
  const decrees = acts?.items ?? [];
  const reception = receptionPhone(contacts);

  return (
    <>
      <PageHeader crumbs={[{ label: section("title"), href: "/services" }, { label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageBody
        aside={
          <>
            <FactList
              items={[
                { label: t("facts.priceList"), value: t("facts.priceListValue") },
                { label: t("facts.payment"), value: t("facts.paymentValue") },
                { label: t("facts.phone"), value: reception && <PhoneLink value={reception} /> },
              ]}
            />
            <SeeAlso
              title={t("more.title")}
              items={[
                { href: "/services/state", label: t("more.state"), text: t("more.stateText") },
                { href: "/legal", label: t("more.legal") },
                { href: "/compliance", label: t("more.compliance") },
              ]}
            />
          </>
        }
      >
        <Notice tone="warning">{t("notice")}</Notice>

        <Block id="decree" title={t("decree.title")} text={t("decree.text")}>
          <p className="max-w-3xl border-l-2 border-primary pl-4 font-medium">{t("decree.name")}</p>
          {decrees.length > 0 ? (
            <RecordList>{decrees.map((act) => <ActRow key={act.id} act={act} locale={locale} />)}</RecordList>
          ) : (
            <Notice title={t("decree.pendingTitle")}>{t("decree.pending")}</Notice>
          )}
        </Block>

        <Block id="price-list" title={t("price.title")} text={t("price.text")}>
          <PriceTable items={[]} />
        </Block>

        <Block id="ask" title={t("ask.title")} text={t("ask.text")}>
          {contacts && (
            <p className="flex flex-wrap gap-x-8 gap-y-2">
              {reception && <PhoneLink value={reception} className="font-semibold" />}
              <MailLink value={contacts.email} className="font-semibold" />
            </p>
          )}
          <p><Link href="/contacts" className="text-link font-medium">{t("ask.link")}</Link></p>
        </Block>
      </PageBody>
    </>
  );
}
