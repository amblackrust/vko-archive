import { setRequestLocale } from "next-intl/server";
import { ImportExportView } from "@/components/admin/import/import-export-view";

export default async function AdminImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ImportExportView />;
}
