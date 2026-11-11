import { setRequestLocale } from "next-intl/server";
import { SettingsView } from "@/components/admin/settings/settings-view";

export default async function AdminSettingsViewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SettingsView />;
}
