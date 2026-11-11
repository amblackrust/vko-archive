import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActRow } from "@/components/legal/act-row";
import { legalFetch, type LegalActsResponse } from "@/components/legal/api";
import { safe } from "@/components/misc/api";
import { PageSection, PageStack } from "@/components/misc/blocks";
import { MailLink, PhoneLink } from "@/components/misc/contact-links";
import { pageMetadata } from "@/components/misc/metadata";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { RecordList } from "@/components/ui/record-list";
import { fetchContacts, receptionPhone } from "@/lib/api/content";
import { Link } from "@/lib/i18n/navigation";

export const generateMetadata = pageMetadata("services.paid", "/services/paid");

/**
 * Платные услуги: как узнать стоимость и каким постановлением утверждён прейскурант. Цен и оплаты на странице нет.
 * Само постановление показывается, если оно внесено в перечень актов (поиск по слову «прейскурант»).
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
  const panel = "card flex h-full flex-col gap-4 p-6 sm:p-8";

  return (
    <>
      <PageHeader crumbs={[{ label: section("title"), href: "/services" }, { label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageStack>
        <div className="grid gap-4 lg:auto-rows-fr lg:grid-cols-2">
          <section aria-labelledby="paid-ask" className={panel}>
            <h2 id="paid-ask" className="text-2xl">{t("ask.title")}</h2>
            <p>{t("ask.text")}</p>
            {contacts && (
              <p className="flex flex-col gap-2 text-lg font-semibold [&_svg]:mt-1.5">
                {reception && <PhoneLink value={reception} />}
                <MailLink value={contacts.email} />
              </p>
            )}
            <p className="mt-auto border-t pt-4 text-[0.9375rem] text-muted-foreground">
              {t("notice")} <Link href="/contacts" className="text-link font-medium">{t("ask.link")}</Link>
            </p>
          </section>

          <section aria-labelledby="paid-decree" className={panel}>
            <h2 id="paid-decree" className="text-2xl">{t("decree.title")}</h2>
            <p>{t("decree.text")}</p>
            <p className="reading border-l-2 border-primary pl-4">{t("decree.name")}</p>
          </section>
        </div>

        {decrees.length > 0 && <RecordList>{decrees.map((act) => <ActRow key={act.id} act={act} locale={locale} />)}</RecordList>}

        <PageSection id="more" title={t("more.title")}>
          <ul className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
            <li><LinkTile href="/services/state" title={t("more.state")} text={t("more.stateText")} /></li>
            <li><LinkTile href="/legal" title={t("more.legal")} text={section("routes.legal.text")} /></li>
            <li><LinkTile href="/compliance" title={t("more.compliance")} text={section("routes.compliance.text")} /></li>
          </ul>
        </PageSection>
      </PageStack>
    </>
  );
}
