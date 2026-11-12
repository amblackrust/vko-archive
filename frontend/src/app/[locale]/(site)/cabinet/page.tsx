import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHead } from "@/components/ui/page-head";
import { CabinetApp } from "@/components/cabinet/cabinet-app";

export default async function CabinetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("cabinet");
  return (
    <>
      <PageHead title={t("title")} />
      <div className="wrap"><CabinetApp /></div>
    </>
  );
}
