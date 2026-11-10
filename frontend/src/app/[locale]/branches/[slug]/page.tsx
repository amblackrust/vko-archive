import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { BranchCard } from "@/components/map/branch-card";
import { BranchMap } from "@/components/map/branch-map-loader";
import { fetchBranch } from "@/lib/api/branches";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const branch = await fetchBranch(slug, locale);
  return { title: branch?.name };
}

export default async function BranchPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const branch = await fetchBranch(slug, locale);
  if (!branch) notFound();
  const t = await getTranslations("map");
  return (
    <>
      <Breadcrumbs items={[{ label: t("title"), href: "/branches" }, { label: branch.name }]} />
      <div className="container-page grid gap-6 pb-12 lg:grid-cols-2">
        <div>
          <BranchCard branch={branch} locale={locale} headingLevel={1} />
        </div>
        {branch.show_on_map && (
          <div className="h-[22rem] overflow-hidden rounded-lg border lg:h-[32rem]">
            <BranchMap branches={[branch]} selected={branch.slug} label={t("map.label")} tileErrorText={t("map.tilesFailed")} />
          </div>
        )}
      </div>
    </>
  );
}
