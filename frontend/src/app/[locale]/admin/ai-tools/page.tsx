import { setRequestLocale } from "next-intl/server";
import { AiToolsView } from "@/components/admin/ai-tools/ai-tools-view";

export default async function AdminAiToolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AiToolsView />;
}
