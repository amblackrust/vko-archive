import { setRequestLocale } from "next-intl/server";
import { InfoPage } from "@/components/about/info-page";

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InfoPage pageKey="history" locale={locale} />;
}
