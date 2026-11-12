import { getTranslations, setRequestLocale } from "next-intl/server";
import { api, type Schema } from "@/lib/api/client";
import { PageHead } from "@/components/ui/page-head";
import { LinkRows } from "@/components/ui/link-rows";

export default async function LinksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nav] = await Promise.all([getTranslations("info.links"), getTranslations("nav.groups")]);
  const settings = await api.get<Schema["PublicSettings"]>("/api/site-settings").catch(() => null);
  const base = t.raw("items") as { title: string; url: string }[];
  const extra = (settings?.useful_links ?? []).map((l) => ({ title: l.title, url: l.url }));
  const seen = new Set<string>();
  const rows = [...extra, ...base].filter((r) => (seen.has(r.url) ? false : seen.add(r.url)));
  return (
    <>
      <PageHead title={t("title")} lead={t("note")} crumbs={[{ label: nav("useful") }, { label: t("title") }]} />
      <div className="wrap"><LinkRows rows={rows.map((r) => ({ title: r.title, href: r.url, external: true }))} /></div>
    </>
  );
}
