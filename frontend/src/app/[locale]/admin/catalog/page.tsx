import { setRequestLocale } from "next-intl/server";
import { CatalogView } from "@/components/admin/catalog/catalog-view";

export default async function AdminCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CatalogView />;
}
