import { getTranslations, setRequestLocale } from "next-intl/server";
import { Timeline, type TimelineQuery } from "@/components/timeline/timeline";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableState } from "@/components/ui/state-view";
import { attempt, fetchTimeline } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "timeline" });
  return { title: t("title"), description: t("intro"), alternates: localizedAlternates(locale, "/memory/timeline") };
}

export default async function TimelinePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("timeline");
  const tm = await getTranslations("memory");
  const data = await attempt(fetchTimeline(locale));
  if (!data) return <UnavailableState />;
  const sp = await searchParams;
  const query: TimelineQuery = {};
  for (const key of ["theme", "decade", "year", "event"] as const) {
    if (typeof sp[key] === "string") query[key] = sp[key];
  }

  return (
    <>
      <PageHeader crumbs={[{ label: tm("breadcrumb"), href: "/memory" }, { label: t("breadcrumb") }]} title={t("title")} lead={t("intro")} />
      <div className="container-page py-6 pb-16">
        {data.items.length === 0 ? (
          <div className="card max-w-2xl space-y-4 p-6">
            <p className="text-lg font-semibold">{t("empty.title")}</p>
            <p className="text-muted-foreground">{t("empty.text")}</p>
            <Button asChild variant="outline"><Link href="/calendar">{t("empty.calendar")}</Link></Button>
          </div>
        ) : (
          <Timeline events={data.items} themes={data.themes} query={query} />
        )}
      </div>
    </>
  );
}
