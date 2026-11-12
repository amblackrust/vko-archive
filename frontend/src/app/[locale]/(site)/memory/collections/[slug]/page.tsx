import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ApiError, api, type Schema } from "@/lib/api/client";
import { PageHead } from "@/components/ui/page-head";
import { DocStrip } from "@/components/memory/doc-strip";

export default async function CollectionPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [t, nav, lang] = await Promise.all([getTranslations("memory"), getTranslations("nav.items"), getLocale()]);
  const c = await api.get<Schema["CollectionDetail"]>(`/api/memory/collections/${slug}`, { query: { lang }, revalidate: 0 }).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <PageHead title={c.title} lead={c.description} crumbs={[{ label: t("title"), href: "/memory" }, { label: nav("memoryCollections"), href: "/memory/collections" }, { label: c.title }]}
        meta={<>{c.period && <span className="edge">{c.period}</span>}</>} />
      <div className="wrap">
        <h2 className="mb-4 text-3xl">{t("documents")} <span className="tnum text-xl text-ink-3">{c.documents.length}</span></h2>
        <DocStrip docs={c.documents} />
      </div>
    </>
  );
}
