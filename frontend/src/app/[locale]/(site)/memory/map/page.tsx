import { getLocale, setRequestLocale } from "next-intl/server";
import { api, type Schema } from "@/lib/api/client";
import { HistoryMap } from "@/components/memory/history-map";

export default async function HistoryMapPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = await getLocale();
  const res = await api.get<Schema["MapPointsResponse"]>("/api/memory/map-points", { query: { lang } }).catch(() => null);
  return <HistoryMap events={res?.items ?? []} />;
}
