import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ExternalServiceLinks } from "@/components/services/external-links";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { Notice } from "@/components/ui/notice";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";
import { KeyFacts } from "@/components/ui/facts";

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

/** Справочный раздел госуслуги: условия, каналы, документы и сроки по приказу № 159. Заявления здесь не принимаются. */
export default async function StateServicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services.state");
  const section = await getTranslations("services.index");
  const h2 = "text-2xl";

  return (
    <>
      <Breadcrumbs items={[{ label: section("title"), href: "/services" }, { label: t("title") }]} />
      <div className="container-page space-y-12 pb-16">
        <header className="max-w-3xl space-y-4">
          <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
          <p className="text-lg text-muted-foreground">{t("intro")}</p>
          <Notice tone="warning">{t("notice")}</Notice>
          {locale !== "ru" && <p className="text-sm text-muted-foreground">{t("translationNote")}</p>}
        </header>

        <section aria-labelledby="state-service" className="space-y-6">
          <h2 id="state-service" className={h2}>{t("serviceName")}</h2>
          <KeyFacts items={FACTS.map((id) => ({ label: t(`facts.${id}.label`), value: t(`facts.${id}.value`) }))} />
        </section>

        <section aria-labelledby="state-channels" className="space-y-6">
          <div className="max-w-3xl space-y-2">
            <h2 id="state-channels" className={h2}>{t("channels.title")}</h2>
            <p className="text-muted-foreground">{t("channels.text")}</p>
          </div>
          <ul className="grid gap-6 lg:grid-cols-3">
            {CHANNELS.map((id) => (
              <li key={id} className="flex flex-col gap-3 card p-6">
                <h3 className="text-lg">{t(`channels.${id}.title`)}</h3>
                <p className="text-sm">{t(`channels.${id}.text`)}</p>
                <p className="mt-auto text-sm text-muted-foreground">{t(`channels.${id}.hours`)}</p>
                {id === "egov" && <ExternalLink href="https://egov.kz" className="font-semibold text-primary">{t("channels.egov.link")}</ExternalLink>}
                {id === "office" && <Link href="/contacts" className="text-link font-semibold">{t("channels.office.link")}</Link>}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="state-steps" className="space-y-6">
          <h2 id="state-steps" className={h2}>{t("steps.title")}</h2>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((id, index) => (
              <li key={id} className="border-t-2 border-primary pt-4">
                <p className="text-sm font-semibold tabular-nums text-primary">{index + 1}</p>
                <h3 className="mt-1 text-base">{t(`steps.${id}.title`)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t(`steps.${id}.text`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid gap-12 lg:grid-cols-2">
          <section aria-labelledby="state-documents" className="space-y-4">
            <h2 id="state-documents" className={h2}>{t("documents.title")}</h2>
            <ul className="card divide-y px-5">
              {DOCUMENTS.map((id) => <li key={id} className="py-3">{t(`documents.${id}`)}</li>)}
            </ul>
            <div className="card p-5">
              <h3 className="text-base">{t("tip.title")}</h3>
              <p className="mt-1 text-sm">{t("tip.text")}</p>
              <Button asChild variant="outline" className="mt-4"><Link href="/navigator">{t("tip.link")}</Link></Button>
            </div>
          </section>
          <section aria-labelledby="state-refusals" className="space-y-4">
            <h2 id="state-refusals" className={h2}>{t("refusals.title")}</h2>
            <ul className="card divide-y px-5">
              {REFUSALS.map((id) => <li key={id} className="py-3">{t(`refusals.${id}`)}</li>)}
            </ul>
            <h2 id="state-other" className={`${h2} pt-6`}>{t("other.title")}</h2>
            <ul className="card divide-y px-5">
              {OTHER_SERVICES.map((id) => <li key={id} className="py-3">{t(`other.${id}`)}</li>)}
            </ul>
            <p className="text-sm text-muted-foreground">{t("other.note")}</p>
          </section>
        </div>

        <section aria-labelledby="state-law" className="space-y-4">
          <h2 id="state-law" className={h2}>{t("lawsHeading")}</h2>
          <ul className="card divide-y px-5">
            <li className="py-3"><ExternalLink href={LAW_URL}>{t("law")}</ExternalLink></li>
            <li className="py-3"><ExternalLink href={RULES_URL}>{t("rules")}</ExternalLink></li>
          </ul>
          <p className="text-sm text-muted-foreground">{t("checked")}</p>
          <p><Link href="/legal" className="text-link font-medium">{t("allActs")}</Link></p>
        </section>

        <div className="grid gap-12 lg:grid-cols-2">
          <section aria-labelledby="state-reports" className="space-y-3">
            <h2 id="state-reports" className={h2}>{t("reportsHeading")}</h2>
            <p className="text-muted-foreground">{t("reportsPending")}</p>
          </section>
          <section aria-labelledby="state-contacts" className="space-y-3">
            <h2 id="state-contacts" className={h2}>{t("contactsHeading")}</h2>
            <p>
              {t("contactsText")} <a href="tel:+77232255976" className="font-semibold whitespace-nowrap">8 (7232) 25-59-76</a>
            </p>
            <p><Link href="/contacts" className="text-link font-medium">{t("contactsLink")}</Link></p>
          </section>
        </div>

        <section aria-labelledby="state-external" className="space-y-4 card p-6">
          <h2 id="state-external" className="text-xl">{t("externalHeading")}</h2>
          <p className="max-w-3xl text-sm">{t("externalText")}</p>
          <ExternalServiceLinks />
        </section>
      </div>
    </>
  );
}
