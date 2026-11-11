import { setRequestLocale } from "next-intl/server";
import { MemoryView } from "@/components/admin/memory/memory-view";

export default async function AdminMemoryViewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MemoryView />;
}
