import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHead } from "@/components/ui/page-head";
import { PhotoGallery } from "@/components/ui/photo-gallery";

export default async function PublicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("info.publications");
  return (
    <>
      <PageHead title={t("title")} lead={t("text")} />
      <section className="wrap"><h2 className="mb-5 text-3xl md:text-4xl">{t("photos")}</h2><PhotoGallery /></section>
    </>
  );
}
