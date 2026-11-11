import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalActCard } from "@/components/legal/act-card";
import { legalFetch, type CompliancePage as CompliancePageData } from "@/components/legal/api";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "compliance" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/compliance") };
}

/** Комплаенс-служба: открытые материалы и комплаенс-офицер. Тексты страницы — из БД (санитизированный HTML). */
export default async function CompliancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("compliance");
  // Страница не опубликована (404) -> 404 сайта; сетевая ошибка -> error.tsx.
  const page = await legalFetch<CompliancePageData>("compliance", new URLSearchParams(), locale);
  if (!page) notFound();

  return (
    <>
      <Breadcrumbs items={[{ label: page.title }]} />
      <div className="container-page space-y-8 pb-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold" lang={page.title_lang}>{page.title}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
          {page.officer && <p className="font-medium">{t("officer", { name: page.officer })}</p>}
          <p className="text-sm text-muted-foreground">
            {t("phoneHint")}{" "}
            <Link href="/contacts" className="text-primary hover:underline">{t("contactsLink")}</Link>
          </p>
        </header>

        {page.body_lang !== locale && (
          <p className="flex items-center gap-3 text-sm text-muted-foreground">
            <DemoBadge kind="noTranslation" />
            {t("translationNote", { lang: page.body_lang })}
          </p>
        )}
        <div
          className="max-w-3xl space-y-3 leading-relaxed"
          lang={page.body_lang}
          // Санитизированный HTML из страницы БД (seed/CMS), не пользовательский ввод.
          dangerouslySetInnerHTML={{ __html: page.body }}
        />

        <section aria-labelledby="compliance-documents" className="space-y-4">
          <h2 id="compliance-documents" className="text-xl font-semibold">{t("documentsHeading")}</h2>
          {page.documents.length === 0 ? (
            <p className="text-muted-foreground">{t("documentsEmpty")}</p>
          ) : (
            <ul className="space-y-3">
              {page.documents.map((act) => (
                <li key={act.id}>
                  <LegalActCard act={act} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
