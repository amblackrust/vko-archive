import { getTranslations, setRequestLocale } from "next-intl/server";
import { Navigator } from "@/components/navigator/navigator";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "navigator" });
  return { title: t("title"), description: t("lead"), alternates: localizedAlternates(locale, "/navigator") };
}

/** Навигатор «Где искать документы»: три шага от цели посетителя до понятной инструкции. Заявления не принимаются. */
export default async function NavigatorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("navigator");
  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <div className="container-page space-y-8 py-8 pb-16">
        <Notice className="max-w-3xl">{t("notice")}</Notice>
        <Navigator />
      </div>
    </>
  );
}
