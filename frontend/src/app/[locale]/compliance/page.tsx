import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TranslationNote } from "@/components/help/translation-note";
import { legalFetch, type CompliancePage as ComplianceData } from "@/components/legal/api";
import { DocTile } from "@/components/legal/doc-tile";
import { safe } from "@/components/misc/api";
import { PageSection } from "@/components/misc/blocks";
import { PhoneLink } from "@/components/misc/contact-links";
import { pageMetadata } from "@/components/misc/metadata";
import { SeeAlso } from "@/components/misc/page-layout";
import { RichText } from "@/components/misc/rich-text";
import { Unavailable } from "@/components/misc/state-help";
import { GovServiceCard } from "@/components/ui/brand";
import { FactList } from "@/components/ui/facts";
import { PageHeader } from "@/components/ui/page-header";
import { fetchContacts, receptionPhone } from "@/lib/api/content";
import { cn } from "@/lib/utils";

export const generateMetadata = pageMetadata("compliance", "/compliance");

/** Комплаенс-служба: офицер, сведения о работе службы, куда сообщить о нарушении и открытые документы из API. */
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
  const reception = receptionPhone(contacts);
  const documents = page.documents;

  return (
    <>
      <PageHeader crumbs={[{ label: page.title }]} title={page.title} titleLang={page.title_lang} lead={t("lead")} />
      <div className="container-page space-y-14 pb-16 pt-4">
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section id="about" aria-labelledby="about-title" className="min-w-0 scroll-mt-28">
            <h2 id="about-title" className="text-2xl sm:text-3xl">{t("about")}</h2>
            <article className="card mt-6 space-y-4 p-6 sm:p-10">
              <TranslationNote requested={locale} actual={page.body_lang} />
              <RichText html={page.body} lang={page.body_lang} />
            </article>
          </section>

          <aside className="space-y-8 self-start lg:sticky lg:top-28">
            <FactList
              items={[
                { label: t("officer"), value: page.officer && <span lang="ru">{page.officer}</span> },
                { label: t("receptionPhone"), value: reception && <PhoneLink value={reception} /> },
              ]}
            />
            <section aria-labelledby="report-title">
              <h2 id="report-title" className="mb-2 text-base">{t("report.title")}</h2>
              <p className="mb-3 text-[0.9375rem] text-muted-foreground">{t("report.text")}</p>
              <GovServiceCard id="eotinish" compact />
            </section>
            <SeeAlso
              title={t("more.title")}
              items={[
                { href: "/legal", label: t("more.legal") },
                { href: "/services/paid", label: t("more.paid") },
                { href: "/contacts", label: t("more.contacts") },
              ]}
            />
          </aside>
        </div>

        {documents.length > 0 && (
          <PageSection id="documents" title={t("documents.title")} text={t("documents.text")}>
            <ul className={cn("grid gap-4 sm:auto-rows-fr sm:grid-cols-2", documents.length % 3 === 0 || documents.length % 2 !== 0 ? "lg:grid-cols-3" : "")}>
              {documents.map((act) => <li key={act.id}><DocTile act={act} /></li>)}
            </ul>
          </PageSection>
        )}
      </div>
    </>
  );
}
