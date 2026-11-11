import { getTranslations, setRequestLocale } from "next-intl/server";
import { CabinetApp } from "@/components/cabinet/cabinet-app";
import { SECTIONS } from "@/components/cabinet/sections";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cabinet" });
  return { title: t("title"), robots: { index: false } };
}

/** Личный кабинет: необязательная персонализация (избранное, подборки, история поиска, подписки) без заявлений, заказов и оплаты. */
export default async function CabinetPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ section?: string | string[] }> }) {
  const { locale } = await params;
  const { section } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("cabinet");
  const active = SECTIONS.find((id) => id === section) ?? SECTIONS[0];
  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("intro")} />
      <div className="container-page py-8 lg:py-10">
        <CabinetApp section={active} />
      </div>
    </>
  );
}
