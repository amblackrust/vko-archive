import { setRequestLocale } from "next-intl/server";
import { RolesView } from "@/components/admin/roles/roles-view";

export default async function AdminRolesViewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RolesView />;
}
