import { Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HelpNav } from "@/components/help/help-nav";
import { TranslationNote } from "@/components/help/translation-note";
import { safe } from "@/components/misc/api";
import { JsonLd } from "@/components/misc/json-ld";
import { pageMetadata } from "@/components/misc/metadata";
import { PageToc } from "@/components/misc/page-layout";
import { Unavailable } from "@/components/misc/state-help";
import { LinkList } from "@/components/ui/link-list";
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
      <div className="container-page grid gap-10 py-10 pb-16 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
        {groups.length > 1 && (
          <div className="self-start lg:sticky lg:top-28">
            <PageToc title={t("faq.toc")} items={groups.map((group) => ({ id: group.category, label: topic(group.category) }))} />
          </div>
        )}
        <div className="min-w-0 max-w-3xl space-y-12">
          {groups.length === 0 && <p className="text-muted-foreground">{t("faq.empty")}</p>}
          {groups.map((group) => (
            <section key={group.category} id={group.category} aria-labelledby={`${group.category}-title`} className="scroll-mt-28">
              <h2 id={`${group.category}-title`} className="text-2xl">{topic(group.category)}</h2>
              <div className="card mt-4 divide-y px-5 sm:px-6">
                {group.items.map((item) => (
                  <details key={item.id} className="group">
                    <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-4 py-4 font-semibold hover:text-primary [&::-webkit-details-marker]:hidden">
                      <span lang={item.lang}>{item.question}</span>
                      <Plus className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-45" aria-hidden />
                    </summary>
                    <div className="space-y-2 pb-5 pr-9">
                      <p lang={item.lang}>{item.answer}</p>
                      <TranslationNote requested={locale} actual={item.lang} status={item.translation_status} />
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
          <section aria-labelledby="faq-more" className="space-y-3">
            <h2 id="faq-more" className="text-lg">{t("faq.more.title")}</h2>
            <LinkList
              items={[
                { href: "/assistant", label: t("next.assistant"), text: t("next.assistantText") },
                { href: "/contacts", label: t("next.contacts"), text: t("faq.more.contactsText") },
              ]}
            />
          </section>
        </div>
      </div>
    </>
  );
}
