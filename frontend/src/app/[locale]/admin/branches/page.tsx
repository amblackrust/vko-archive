import { setRequestLocale } from "next-intl/server";
import { BranchesView } from "@/components/admin/branches/branches-view";

export default async function AdminBranchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BranchesView />;
}
