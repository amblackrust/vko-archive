import { setRequestLocale } from "next-intl/server";
import { TranslationsView } from "@/components/admin/translations/translations-view";

export default async function AdminTranslationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TranslationsView />;
}
