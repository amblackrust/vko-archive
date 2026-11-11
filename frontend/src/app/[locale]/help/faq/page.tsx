import { Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HelpNav } from "@/components/help/help-nav";
import { TranslationNote } from "@/components/help/translation-note";
import { safe } from "@/components/misc/api";
import { JsonLd } from "@/components/misc/json-ld";
import { pageMetadata } from "@/components/misc/metadata";
import { PageToc } from "@/components/misc/page-layout";
import { Unavailable } from "@/components/misc/state-help";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { fetchFaqs } from "@/lib/api/content";

// Порядок тем как в справке; темы, добавленные в админке позже, идут следом в порядке API.
const TOPIC_ORDER = ["catalog", "access", "branches", "memory", "site"];
const rank = (category: string) => (TOPIC_ORDER.indexOf(category) + 1 || TOPIC_ORDER.length + 1);

export const generateMetadata = pageMetadata("help.faq", "/help/faq");

/** Вопросы и ответы из админки, сгруппированные по темам; раскрываются штатным <details>, без скриптов. */
export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help");
  const data = await safe(fetchFaqs(locale));
  if (!data) return <Unavailable />;
  const groups = data.sort((a, b) => rank(a.category) - rank(b.category));
  const topic = (category: string) => (t.has(`faq.topics.${category}`) ? t(`faq.topics.${category}`) : category);

  return (
    <>
      <PageHeader crumbs={[{ label: t("title"), href: "/help" }, { label: t("faq.title") }]} title={t("faq.title")} lead={t("faq.lead")} />
      <HelpNav active="faq" />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: groups.flatMap((group) => group.items).map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
      <div className="container-page grid gap-10 pb-16 pt-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
        <div className="min-w-0 space-y-12">
          {groups.map((group) => (
            <section key={group.category} id={group.category} aria-labelledby={`${group.category}-title`} className="scroll-mt-28">
              <h2 id={`${group.category}-title`} className="text-2xl sm:text-3xl">{topic(group.category)}</h2>
              <div className="card mt-6 divide-y overflow-hidden">
                {group.items.map((item) => (
                  <details key={item.id} className="group open:bg-surface-muted">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[1.0625rem] font-semibold hover:text-primary sm:px-6 [&::-webkit-details-marker]:hidden">
                      <span lang={item.lang}>{item.question}</span>
                      <Plus className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45 group-open:text-primary" aria-hidden />
                    </summary>
                    <div className="max-w-3xl space-y-2 px-5 pb-5 sm:px-6">
                      <p lang={item.lang}>{item.answer}</p>
                      <TranslationNote requested={locale} actual={item.lang} status={item.translation_status} />
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="order-first space-y-8 self-start lg:order-none lg:sticky lg:top-28">
          {groups.length > 1 && <PageToc title={t("faq.toc")} items={groups.map((group) => ({ id: group.category, label: topic(group.category) }))} />}
          <section aria-labelledby="faq-more" className="hidden lg:block">
            <h2 id="faq-more" className="mb-3 text-base">{t("faq.more.title")}</h2>
            <ul className="grid gap-4">
              <li><LinkTile href="/assistant" title={t("next.assistant")} text={t("next.assistantText")} /></li>
              <li><LinkTile href="/contacts" title={t("next.contacts")} text={t("faq.more.contactsText")} /></li>
            </ul>
          </section>
        </aside>

        <section aria-labelledby="faq-more-bottom" className="lg:hidden">
          <h2 id="faq-more-bottom" className="text-2xl">{t("faq.more.title")}</h2>
          <ul className="mt-6 grid gap-4 sm:auto-rows-fr sm:grid-cols-2">
            <li><LinkTile href="/assistant" title={t("next.assistant")} text={t("next.assistantText")} /></li>
            <li><LinkTile href="/contacts" title={t("next.contacts")} text={t("faq.more.contactsText")} /></li>
          </ul>
        </section>
      </div>
    </>
  );
}
