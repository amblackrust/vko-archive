import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { api, type Schema } from "@/lib/api/client";
import { PageHead } from "@/components/ui/page-head";
import { Prose } from "@/components/ui/prose";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/button";

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nav, lang] = await Promise.all([getTranslations("info.about"), getTranslations("nav.items"), getLocale()]);
  const [history, structure] = await Promise.all(["history", "structure"].map((k) => api.get<Schema["PageDetail"]>(`/api/pages/${k}`, { query: { lang } }).catch(() => null)));
  return (
    <>
      <PageHead title={t("title")} actions={<Link href="/about/contacts" className={buttonClass("secondary")}>{nav("contacts")}</Link>} />
      <div className="wrap space-y-20">
        {[history, structure].map((p, i) =>
          p ? (
            <section key={p.key}>
              <h2 className="mb-6 border-b border-line pb-3 text-4xl md:text-5xl">{p.title || (i ? t("structure") : t("history"))}</h2>
              {/* Long text flows in columns on wide screens. */}
              <Prose html={p.body} className="!max-w-none xl:columns-2 xl:gap-16 [&>*]:break-inside-avoid-column [&>h2:first-child]:mt-0" />
            </section>
          ) : null,
        )}
      </div>
    </>
  );
}
