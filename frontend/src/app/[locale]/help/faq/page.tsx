import { getTranslations, setRequestLocale } from "next-intl/server";
import { TranslationNote } from "@/components/help/translation-note";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { fetchFaqs } from "@/lib/api/content";
import { localizedAlternates } from "@/lib/seo";

// Порядок тем как в справке; неизвестные темы идут в конец в порядке API.
const TOPIC_ORDER = ["catalog", "access", "branches", "memory", "site"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "help" });
  return { title: t("faq.title"), alternates: localizedAlternates(locale, "/help/faq") };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help");
  const groups = (await fetchFaqs(locale)).sort(
    (a, b) => topicRank(a.category) - topicRank(b.category),
  );
  return (
    <>
      <Breadcrumbs items={[{ label: t("title"), href: "/help" }, { label: t("faq.title") }]} />
      <div className="container-page space-y-10 pb-12">
        <header className="max-w-3xl space-y-2">
          <h1 className="text-3xl font-bold">{t("faq.title")}</h1>
          <p className="text-muted-foreground">{t("faq.intro")}</p>
        </header>
        {groups.map((group) => (
          <section key={group.category} id={group.category} className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-semibold">
              {t.has(`faq.topics.${group.category}`) ? t(`faq.topics.${group.category}`) : group.category}
            </h2>
            <div className="max-w-3xl space-y-2">
              {group.items.map((item) => (
                <details key={item.id} className="rounded-lg border bg-surface p-4">
                  <summary className="cursor-pointer font-medium">{item.question}</summary>
                  <div className="mt-3 space-y-2" lang={item.lang}>
                    <p>{item.answer}</p>
                    <TranslationNote requested={locale} actual={item.lang} status={item.translation_status} />
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function topicRank(category: string): number {
  const index = TOPIC_ORDER.indexOf(category);
  return index === -1 ? TOPIC_ORDER.length : index;
}
