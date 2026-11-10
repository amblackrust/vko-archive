import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { BranchesExplorer } from "@/components/map/branches-explorer";
import { fetchBranches } from "@/lib/api/branches";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "map" });
  return { title: t("title") };
}

export default async function BranchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("map");
  const branches = await fetchBranches(locale);
  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
        </header>
        <BranchesExplorer branches={branches} />
      </div>
    </>
  );
}
