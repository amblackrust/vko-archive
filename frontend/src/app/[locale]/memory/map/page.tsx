import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { HistoryExplorer } from "@/components/history-map/history-explorer";
import { Link } from "@/lib/i18n/navigation";
import { fetchMapPoints } from "@/lib/api/memory";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "historyMap" });
  return { title: t("title") };
}

export default async function HistoryMapPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("historyMap");
  const tm = await getTranslations("memory");
  const { items, themes } = await fetchMapPoints(locale);
  return (
    <>
      <Breadcrumbs items={[{ label: tm("breadcrumb"), href: "/memory" }, { label: t("breadcrumb") }]} />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
          <p className="max-w-3xl rounded-md border bg-accent-soft p-3 text-sm text-accent-soft-foreground">
            {t("separate")} <Link href="/branches" className="font-medium underline">{t("toBranches")}</Link>. {t("approx")}
          </p>
        </header>
        <HistoryExplorer points={items} kinds={themes} />
      </div>
    </>
  );
}
