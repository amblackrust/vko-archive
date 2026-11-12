import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHead } from "@/components/ui/page-head";
import { LinkRows } from "@/components/ui/link-rows";

export default async function SymbolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nav] = await Promise.all([getTranslations("info.symbols"), getTranslations("nav.groups")]);
  return (
    <>
      <PageHead title={t("title")} lead={t("text")} crumbs={[{ label: nav("useful") }, { label: t("title") }]} />
      <div className="wrap"><LinkRows rows={[{ title: "Akorda.kz", href: "https://www.akorda.kz", external: true, note: t("open") }, { title: "gov.kz", href: "https://www.gov.kz", external: true, note: t("open") }]} /></div>
    </>
  );
}
