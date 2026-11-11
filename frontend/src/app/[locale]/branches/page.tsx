import { getTranslations, setRequestLocale } from "next-intl/server";
import { BranchesExplorer } from "@/components/map/branches-explorer";
import { safe } from "@/components/misc/api";
import { pageMetadata } from "@/components/misc/metadata";
import { Unavailable } from "@/components/misc/state-help";
import { PageHeader } from "@/components/ui/page-header";
import { fetchBranches } from "@/lib/api/branches";

export const generateMetadata = pageMetadata("map", "/branches");

/** Головной архив и филиалы: карта, список, карточка и маршрут в одном окне. */
export default async function BranchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("map");
  const branches = await safe(fetchBranches(locale));
  if (!branches) return <Unavailable />;
  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <div className="container-page pb-12">
        <BranchesExplorer branches={branches} />
      </div>
    </>
  );
}
