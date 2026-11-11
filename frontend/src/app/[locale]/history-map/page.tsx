import { redirect } from "@/lib/i18n/navigation";

// Старый адрес из ТЗ: раздел живёт в «Архиве памяти».
export default async function LegacyHistoryMapRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/memory/map", locale });
}
