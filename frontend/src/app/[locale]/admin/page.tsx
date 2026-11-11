import { setRequestLocale } from "next-intl/server";
import { DashboardView } from "@/components/admin/dashboard/dashboard-view";

export default async function AdminDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DashboardView />;
}
