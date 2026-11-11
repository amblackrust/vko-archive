import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageSection, PageStack } from "@/components/misc/blocks";
import { Navigator } from "@/components/navigator/navigator";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "navigator" });
  return { title: t("title"), description: t("lead"), alternates: localizedAlternates(locale, "/navigator") };
}

/** Навигатор «Где искать документы»: три шага от цели посетителя до понятной инструкции. Заявления не принимаются. */
export default async function NavigatorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("navigator");
  const help = await getTranslations("help");
  const services = await getTranslations("services.index.routes");
  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageStack>
        <Navigator />
        <PageSection id="more" title={t("more.title")}>
          <ul className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
            <li><LinkTile href="/catalog/funds" title={help("materials.items.funds.label")} text={help("materials.items.funds.text")} /></li>
            <li><LinkTile href="/services/state" title={services("certificate.title")} text={t("more.certificate")} /></li>
            <li><LinkTile href="/branches" title={help("site.items.branches.label")} text={help("site.items.branches.text")} /></li>
          </ul>
        </PageSection>
      </PageStack>
    </>
  );
}
