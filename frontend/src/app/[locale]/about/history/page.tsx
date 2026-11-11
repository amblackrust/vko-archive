import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AboutNav } from "@/components/about/about-nav";
import { historyPeriods } from "@/components/about/history";
import { TranslationNote } from "@/components/help/translation-note";
import { safe } from "@/components/misc/api";
import { PageToc } from "@/components/misc/page-layout";
import { RichText } from "@/components/misc/rich-text";
import { Unavailable } from "@/components/misc/state-help";
import { LinkList } from "@/components/ui/link-list";
import { PageHeader } from "@/components/ui/page-header";
import { fetchPage, pageSeo } from "@/lib/api/content";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about.history" });
  const page = await safe(fetchPage("history", locale));
  return { title: t("title"), description: t("lead"), ...(page?.lang === locale ? pageSeo(page) : {}), alternates: localizedAlternates(locale, "/about/history") };
}

/** Историческая справка: длинный текст из CMS, разбитый на десятилетия с оглавлением и отметками годов. */
export default async function HistoryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const page = await fetchPage("history", locale).catch(() => undefined);
  if (page === undefined) return <Unavailable />;
  if (!page) notFound();
  const periods = historyPeriods(page.body);
  const label = (decade: number) => (decade ? t("history.decade", { decade }) : t("history.opening"));

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("title"), href: "/about" }, { label: t("history.title") }]}
        title={page.lang === locale ? page.title : t("history.title")}
        lead={t("history.lead")}
      />
      <AboutNav active="history" />
      <div className="container-page grid gap-10 py-10 pb-16 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
        {periods && (
          <div className="self-start lg:sticky lg:top-28">
            <PageToc title={t("history.toc")} items={periods.map(({ decade }) => ({ id: `y${decade}`, label: label(decade) }))} />
          </div>
        )}
        <article className="min-w-0 space-y-10">
          <TranslationNote requested={locale} actual={page.lang} status={page.translation_status} />
          {!periods && <RichText html={page.body} lang={page.lang} />}
          {periods?.map((period) => (
            <section key={period.decade} id={`y${period.decade}`} aria-labelledby={`y${period.decade}-title`} className="scroll-mt-28">
              <h2 id={`y${period.decade}-title`} className="text-2xl">{label(period.decade)}</h2>
              <div className="mt-6 space-y-5" lang={page.lang}>
                {period.blocks.map((block, index) => (
                  <div key={index} className="grid gap-x-6 gap-y-1 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
                    {block.year && <p className="font-semibold tabular-nums text-primary sm:pt-0.5">{block.year}</p>}
                    <RichText html={block.html} className="sm:col-start-2" />
                  </div>
                ))}
              </div>
            </section>
          ))}
          <footer className="max-w-[70ch] space-y-4 border-t pt-6">
            <p className="text-sm text-muted-foreground">{t("history.source")}</p>
            <LinkList
              items={[
                { href: "/about/structure", label: t("sections.structure.label") },
                { href: "/branches", label: t("sections.branches.label") },
                { href: "/memory/timeline", label: t("history.timeline") },
              ]}
            />
          </footer>
        </article>
      </div>
    </>
  );
}
