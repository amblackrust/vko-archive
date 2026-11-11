import { setRequestLocale } from "next-intl/server";
import { AnalyticsView } from "@/components/admin/analytics/analytics-view";

export default async function AdminAnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AnalyticsView />;
}
