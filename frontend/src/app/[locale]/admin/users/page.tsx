import { setRequestLocale } from "next-intl/server";
import { UsersView } from "@/components/admin/users/users-view";

export default async function AdminUsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <UsersView />;
}
