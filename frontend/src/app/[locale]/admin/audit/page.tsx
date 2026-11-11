import { setRequestLocale } from "next-intl/server";
import { AuditView } from "@/components/admin/audit/audit-view";

export default async function AdminAuditViewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AuditView />;
}
