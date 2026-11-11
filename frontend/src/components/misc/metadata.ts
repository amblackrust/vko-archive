import { getTranslations } from "next-intl/server";
import { localizedAlternates } from "@/lib/seo";

/**
 * generateMetadata для страницы, у которой заголовок и описание лежат в словаре как `title` и `lead`:
 * `export const generateMetadata = pageMetadata("misc.privacy", "/privacy")`.
 */
export const pageMetadata = (namespace: string, path: string) =>
  async ({ params }: { params: Promise<{ locale: string }> }) => {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace });
    return { title: t("title"), description: t("lead"), alternates: localizedAlternates(locale, path) };
  };
