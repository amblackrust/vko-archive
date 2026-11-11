import { setRequestLocale } from "next-intl/server";
import { ContentView } from "@/components/admin/content/content-view";

export default async function AdminContentViewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContentView />;
}
