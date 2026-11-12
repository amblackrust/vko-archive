import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { api, type Schema } from "@/lib/api/client";
import { PageHead } from "@/components/ui/page-head";
import { Prose } from "@/components/ui/prose";
import { LinkRows } from "@/components/ui/link-rows";

export default async function CompliancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nav, lang] = await Promise.all([getTranslations("info.compliance"), getTranslations("nav.items"), getLocale()]);
  const c = await api.get<Schema["CompliancePage"]>("/api/compliance", { query: { lang } }).catch(() => null);
  return (
    <>
      <PageHead title={c?.title || t("title")} crumbs={[{ label: nav("about"), href: "/about" }, { label: t("title") }]} meta={c?.officer ? <span className="text-ink-2">{t("officer")}: {c.officer}</span> : null} />
      <div className="wrap grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        {c?.body && <Prose html={c.body} />}
        {c && c.documents.length > 0 && (
          <aside>
            <h2 className="mb-3 text-2xl">{t("docs")}</h2>
            <LinkRows rows={c.documents.map((d) => ({ title: d.title, href: d.file?.url ?? d.adilet_url ?? "#", external: true, note: d.number ?? undefined }))} />
          </aside>
        )}
      </div>
    </>
  );
}
