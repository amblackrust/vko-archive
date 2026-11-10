import { getTranslations, setRequestLocale } from "next-intl/server";
import { CabinetApp } from "@/components/cabinet/cabinet-app";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DemoBadge } from "@/components/ui/demo-badge";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cabinet" });
  return { title: t("title"), robots: { index: false } };
}

/** Личный кабинет (T5.18): необязательный, без заявлений, заказов и оплаты. */
export default async function CabinetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("cabinet");
  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
          <p className="max-w-3xl text-sm text-muted-foreground">{t("noRequests")}</p>
          <p className="flex items-center gap-2 text-sm">
            <DemoBadge /> {t("demoNotice")}
          </p>
        </header>
        <CabinetApp />
      </div>
    </>
  );
}
