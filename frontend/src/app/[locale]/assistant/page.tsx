import { getTranslations, setRequestLocale } from "next-intl/server";
import { AskButton } from "@/components/ai/chat/ask-button";
import { Chat } from "@/components/ai/chat/chat";
import { QUICK_QUESTIONS } from "@/components/ai/chat/quick";
import { PageHeader } from "@/components/ui/page-header";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

const ABILITIES = ["find", "explain", "contacts", "services"] as const;
const CHECKS = ["source", "notFound", "restricted"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai.page" });
  return { title: t("title"), description: t("lead"), alternates: localizedAlternates(locale, "/assistant") };
}

/** Страница помощника: диалог, что он умеет, три проверочных вопроса (уходят в чат по нажатию) и границы применения. */
export default async function AssistantPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ai");
  return (
    <>
      <PageHeader tone="brand" crumbs={[{ label: t("page.title") }]} title={t("page.title")} lead={t("page.lead")} />
      <div className="container-page grid items-start gap-6 pb-16 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="card overflow-hidden">
          <Chat
            quick={QUICK_QUESTIONS.map((key) => t(`widget.quick.${key}`))}
            inputId="assistant-page-input"
            className="h-[min(46rem,calc(100dvh-7rem))] min-h-[30rem]"
          />
        </div>
        <aside className="space-y-6">
          <section aria-labelledby="assistant-checks" className="card p-5 sm:p-6">
            <h2 id="assistant-checks" className="text-lg">{t("page.checksTitle")}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("page.checksText")}</p>
            <ul className="mt-2 divide-y">
              {CHECKS.map((key) => (
                <li key={key}>
                  <AskButton label={t(`page.checks.${key}.label`)} question={t(`page.checks.${key}.question`)} hint={t("page.checkAsk")} />
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="assistant-can" className="card p-5 sm:p-6">
            <h2 id="assistant-can" className="text-lg">{t("page.canTitle")}</h2>
            <ul className="mt-3 space-y-3 text-[0.9375rem]">
              {ABILITIES.map((key) => (
                <li key={key} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {t(`page.can.${key}`)}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="assistant-limits" className="rounded-lg bg-primary-soft p-5 sm:p-6">
            <h2 id="assistant-limits" className="text-lg">{t("page.limitsTitle")}</h2>
            <p className="mt-1.5 text-[0.9375rem]">{t("page.limits")}</p>
            <p className="mt-3"><Link href="/services/state" className="text-link font-semibold">{t("page.limitsLink")}</Link></p>
          </section>
        </aside>
      </div>
    </>
  );
}
