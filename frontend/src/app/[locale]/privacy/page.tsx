import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { localizedAlternates } from "@/lib/seo";

const sections = ["data", "search", "cookies", "external", "contact"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contacts.privacy" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/privacy") };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contacts.privacy");
  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page max-w-3xl space-y-8 pb-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
        </header>
        {sections.map((key) => (
          <section key={key} className="space-y-2">
            <h2 className="text-xl font-semibold">{t(`sections.${key}.title`)}</h2>
            <p>{t(`sections.${key}.text`)}</p>
          </section>
        ))}
      </div>
    </>
  );
}
