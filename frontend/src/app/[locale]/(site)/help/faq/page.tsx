import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { api, type Schema } from "@/lib/api/client";
import { PageHead } from "@/components/ui/page-head";
import { FaqList } from "@/components/ui/faq-list";

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nav, lang] = await Promise.all([getTranslations("info.faq"), getTranslations("nav.primary"), getLocale()]);
  const res = await api.get<Schema["FaqResponse"]>("/api/faqs", { query: { lang } }).catch(() => null);
  return (
    <>
      <PageHead title={t("title")} crumbs={[{ label: nav("help"), href: "/help" }, { label: t("title") }]} />
      <div className="wrap">
        <FaqList groups={(res?.groups ?? []).map((g) => ({ category: g.category, label: t.has(`categories.${g.category}`) ? t(`categories.${g.category}`) : g.category, items: g.items }))} />
      </div>
    </>
  );
}
