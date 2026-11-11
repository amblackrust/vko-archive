import { getTranslations, setRequestLocale } from "next-intl/server";
import { HistoryMapExplorer } from "@/components/history-map/history-map-explorer";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableState } from "@/components/ui/state-view";
import { attempt, fetchMapPoints } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "historyMap" });
  return { title: t("title"), description: t("intro"), alternates: localizedAlternates(locale, "/memory/map") };
}

export default async function HistoryMapPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("historyMap");
  const tm = await getTranslations("memory");
  const data = await attempt(fetchMapPoints(locale));
  if (!data) return <UnavailableState />;
  const { kind, point } = await searchParams;

  return (
    <>
      <PageHeader crumbs={[{ label: tm("breadcrumb"), href: "/memory" }, { label: t("breadcrumb") }]} title={t("title")} lead={t("intro")}>
        {/* Требование заказчика: историческую карту нельзя принять за карту филиалов. */}
        <Notice className="max-w-3xl">
          {t("separate")} <Link href="/branches" className="text-link">{t("toBranches")}</Link>
        </Notice>
      </PageHeader>
      <div className="container-page py-6 pb-16">
        {data.items.length === 0 ? (
          <div className="card max-w-2xl space-y-4 p-6">
            <p className="text-lg font-semibold">{t("empty.title")}</p>
            <p className="text-muted-foreground">{t("empty.text")}</p>
            <Button asChild variant="outline"><Link href="/memory/timeline">{t("empty.timeline")}</Link></Button>
          </div>
        ) : (
          <HistoryMapExplorer
            points={data.items}
            kinds={data.themes}
            query={{ kind: typeof kind === "string" ? kind : undefined, point: typeof point === "string" ? point : undefined }}
          />
        )}
      </div>
    </>
  );
}
