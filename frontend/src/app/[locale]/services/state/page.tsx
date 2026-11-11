import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { safe } from "@/components/misc/api";
import { PageSection, PageStack, PointList, StepCards } from "@/components/misc/blocks";
import { PhoneLink } from "@/components/misc/contact-links";
import { SourceCard } from "@/components/misc/source-card";
import { GovServiceCard } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { KeyFacts } from "@/components/ui/facts";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { fetchContacts, receptionPhone } from "@/lib/api/content";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

/** Официальные публикации на портале «Әділет»; сведения страницы сверены с ними (см. state.checked). */
const RULES_URL = "https://adilet.zan.kz/rus/docs/V2000020790";
const LAW_URL = "https://adilet.zan.kz/rus/docs/Z1300000088";

const FACTS = ["term", "cost", "result", "form"] as const;
const CHANNELS = ["egov", "gov4c", "office"] as const;
const STEPS = ["apply", "register", "check", "result"] as const;
const DOCUMENTS = ["application", "identity", "proxy", "supporting"] as const;
const REFUSALS = ["invalid", "requirements", "consent"] as const;
const OTHER_SERVICES = ["apostille", "export"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services.state" });
  return { title: t("title"), description: t("intro"), alternates: localizedAlternates(locale, "/services/state") };
}

/** Государственная услуга: условия, каналы подачи, этапы, документы и нормативная основа по приказу № 159. Заявления здесь не принимаются. */
export default async function StateServicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services.state");
  const section = await getTranslations("services.index");
  const reception = receptionPhone(await safe(fetchContacts()));
  const h2 = "text-2xl sm:text-3xl";
  const pair = "grid grid-rows-subgrid gap-y-6";

  return (
    <>
      <PageHeader crumbs={[{ label: section("title"), href: "/services" }, { label: t("title") }]} title={t("title")} lead={t("intro")}>
        <Notice tone="warning" className="max-w-3xl">{t("notice")}</Notice>
        {locale !== "ru" && t("translationNote") && <p className="text-sm text-muted-foreground">{t("translationNote")}</p>}
      </PageHeader>

      <PageStack>
        <section aria-labelledby="state-service">
          <h2 id="state-service" className={`max-w-4xl ${h2}`}>{t("serviceName")}</h2>
          <KeyFacts className="mt-6" items={FACTS.map((id) => ({ label: t(`facts.${id}.label`), value: <span className="text-lg sm:text-2xl">{t(`facts.${id}.value`)}</span> }))} />
        </section>

        <PageSection id="channels" title={t("channels.title")} text={t("channels.text")}>
          {/* Строки карточек выровнены общей сеткой: заголовок, условия, часы приёма, ссылка. */}
          <ul className="grid gap-4 lg:grid-cols-3">
            {CHANNELS.map((id) => (
              <li key={id} className="card row-span-4 grid grid-rows-subgrid gap-y-3 p-6">
                <h3 className="text-lg">{t(`channels.${id}.title`)}</h3>
                <p>{t(`channels.${id}.text`)}</p>
                <p className="border-t pt-3 text-[0.9375rem] text-muted-foreground">{t(`channels.${id}.hours`)}</p>
                <p>
                  {id === "egov" && <ExternalLink href="https://egov.kz" className="font-semibold text-primary">{t("channels.egov.link")}</ExternalLink>}
                  {id === "office" && <Link href="/contacts" className="text-link font-semibold">{t("channels.office.link")}</Link>}
                </p>
              </li>
            ))}
          </ul>
        </PageSection>

        <PageSection id="steps" title={t("steps.title")}>
          <StepCards items={STEPS.map((id) => ({ title: t(`steps.${id}.title`), text: t(`steps.${id}.text`) }))} />
        </PageSection>

        {/* Парные секции стоят на общей сетке строк: заголовки, карточки и примечания выровнены между колонками. */}
        <div className="grid gap-x-6 gap-y-14 lg:grid-cols-2">
          <section aria-labelledby="state-documents" className={`${pair} row-span-2`}>
            <h2 id="state-documents" className={h2}>{t("documents.title")}</h2>
            <PointList items={DOCUMENTS.map((id) => t(`documents.${id}`))} />
          </section>
          <section aria-labelledby="state-refusals" className={`${pair} row-span-2`}>
            <h2 id="state-refusals" className={h2}>{t("refusals.title")}</h2>
            <PointList items={REFUSALS.map((id) => t(`refusals.${id}`))} />
          </section>
        </div>

        <section aria-labelledby="state-tip" className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5 rounded-lg bg-primary-soft p-6 sm:p-8">
          <div className="max-w-3xl">
            <h2 id="state-tip" className="text-xl sm:text-2xl">{t("tip.title")}</h2>
            <p className="mt-2">{t("tip.text")}</p>
          </div>
          <Button asChild size="lg"><Link href="/navigator">{t("tip.link")} <ArrowRight aria-hidden /></Link></Button>
        </section>

        <div className="grid gap-x-6 gap-y-14 lg:grid-cols-2">
          <section aria-labelledby="state-law" className={`${pair} row-span-3`}>
            <h2 id="state-law" className={h2}>{t("lawsHeading")}</h2>
            <ul className="grid gap-4 lg:auto-rows-fr">
              <li><SourceCard portal="adilet" href={LAW_URL} title={t("law")} /></li>
              <li><SourceCard portal="adilet" href={RULES_URL} title={t("rules")} /></li>
            </ul>
            <p className="text-sm text-muted-foreground">
              {t("checked")} <Link href="/legal" className="text-link font-medium">{t("allActs")}</Link>
            </p>
          </section>
          <section aria-labelledby="state-other" className={`${pair} row-span-3`}>
            <h2 id="state-other" className={h2}>{t("other.title")}</h2>
            <PointList items={OTHER_SERVICES.map((id) => t(`other.${id}`))} />
            <p className="text-sm text-muted-foreground">{t("other.note")}</p>
          </section>
        </div>

        <PageSection id="external" title={t("externalHeading")} text={t("externalText")}>
          <ul className="grid gap-4 lg:auto-rows-fr lg:grid-cols-3">
            <li><GovServiceCard id="egov" /></li>
            <li><GovServiceCard id="eotinish" /></li>
            <li className="card flex h-full flex-col gap-1.5 p-5">
              <h3 className="font-semibold">{t("contactsHeading")}</h3>
              <p className="text-[0.9375rem] text-muted-foreground">{t("contactsText")}</p>
              {reception && <PhoneLink value={reception} className="font-semibold" />}
              <p className="mt-auto pt-2"><Link href="/contacts" className="text-link font-medium">{t("contactsLink")}</Link></p>
            </li>
          </ul>
        </PageSection>
      </PageStack>
    </>
  );
}
