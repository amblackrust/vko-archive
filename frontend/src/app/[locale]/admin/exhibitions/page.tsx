import { setRequestLocale } from "next-intl/server";
import { ExhibitionsView } from "@/components/admin/exhibitions/exhibitions-view";

export default async function AdminExhibitionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ExhibitionsView />;
}
