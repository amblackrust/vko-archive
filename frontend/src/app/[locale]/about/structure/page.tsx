import { setRequestLocale } from "next-intl/server";
import { fetchPage } from "@/lib/api/content";
import { InfoPage } from "@/components/about/info-page";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const page = await fetchPage("structure", locale);
  return { title: page?.title, alternates: localizedAlternates(locale, "/about/structure") };
}

export default async function StructurePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InfoPage pageKey="structure" locale={locale} />;
}
