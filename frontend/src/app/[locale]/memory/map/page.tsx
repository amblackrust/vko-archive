import { getTranslations, setRequestLocale } from "next-intl/server";
import { HistoryMapExplorer } from "@/components/history-map/history-map-explorer";
import { LinkTile } from "@/components/ui/link-tile";
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

/** Историческая карта: карта и список мест в одном окне; под окном — условные обозначения и ссылка на карту филиалов. */
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
      <PageHeader crumbs={[{ label: tm("breadcrumb"), href: "/memory" }, { label: t("breadcrumb") }]} title={t("title")} lead={t("intro")} />
      <div className="container-page pb-16 pt-2">
        {data.items.length === 0 ? (
          <ul className="grid max-w-3xl auto-rows-fr gap-4 sm:grid-cols-2">
            <li><LinkTile href="/memory/timeline" title={t("empty.timeline")} /></li>
            <li><LinkTile href="/memory" title={tm("title")} /></li>
          </ul>
        ) : (
          <>
            <HistoryMapExplorer
              points={data.items}
              kinds={data.themes}
              query={{ kind: typeof kind === "string" ? kind : undefined, point: typeof point === "string" ? point : undefined }}
            />
            {/* Историческую карту нельзя принять за карту филиалов: различие названо рядом с условными обозначениями. */}
            <div className="mt-4 grid gap-x-10 gap-y-2 text-sm text-muted-foreground lg:grid-cols-2">
              <p>{t("legend")}</p>
              <p>{t("separate")} <Link href="/branches" className="text-link">{t("toBranches")}</Link></p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
