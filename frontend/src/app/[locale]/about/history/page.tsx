import { setRequestLocale } from "next-intl/server";
import { fetchPage, pageSeo } from "@/lib/api/content";
import { InfoPage } from "@/components/about/info-page";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const page = await fetchPage("history", locale);
  return { ...pageSeo(page), alternates: localizedAlternates(locale, "/about/history") };
}

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InfoPage pageKey="history" locale={locale} />;
}
