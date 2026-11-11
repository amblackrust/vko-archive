import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Timeline } from "@/components/timeline/timeline";
import { fetchTimeline } from "@/lib/api/memory";
import { localizedAlternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "timeline" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/memory/timeline") };
}

export default async function TimelinePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ event?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { event } = await searchParams;
  const t = await getTranslations("timeline");
  const tm = await getTranslations("memory");
  const { items, themes } = await fetchTimeline(locale);
  return (
    <>
      <Breadcrumbs items={[{ label: tm("breadcrumb"), href: "/memory" }, { label: t("breadcrumb") }]} />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
        </header>
        <Timeline events={items} themes={themes} initialSlug={event} />
      </div>
    </>
  );
}
