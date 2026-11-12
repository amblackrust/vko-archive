import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { api, type Schema } from "@/lib/api/client";
import { PageHead } from "@/components/ui/page-head";
import { TimelineView } from "@/components/memory/timeline-view";

export default async function TimelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nav, lang] = await Promise.all([getTranslations("memory"), getTranslations("nav.items"), getLocale()]);
  const res = await api.get<Schema["TimelineResponse"]>("/api/memory/timeline", { query: { lang } }).catch(() => null);
  return (
    <>
      <PageHead title={nav("timeline")} crumbs={[{ label: t("title"), href: "/memory" }, { label: nav("timeline") }]} />
      <TimelineView events={res?.items ?? []} themes={res?.themes ?? []} />
    </>
  );
}
