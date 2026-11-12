import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMeta } from "@/lib/seo";
import { PageHead } from "@/components/ui/page-head";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, c] = await Promise.all([getTranslations({ locale, namespace: "info.help" }), getTranslations({ locale, namespace: "common" })]);
  return pageMeta({ locale, path: "/help", title: t("title"), description: c("siteName") });
}

export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("info.help");
  const blocks = t.raw("blocks") as { title: string; text: string }[];
  return (
    <>
      <PageHead title={t("title")} actions={<><Link href="/help/faq" className={buttonClass("secondary")}>{t("faq")}</Link><Link href="/help/reading-room" className={buttonClass("secondary")}>{t("readingRoom")}</Link></>} />
      {/* Two columns, the second one lowered: sheets lie staggered. */}
      <ol className="wrap grid gap-x-10 gap-y-10 md:grid-cols-2 [&>li:nth-child(even)]:md:translate-y-20">
        {blocks.map((b, i) => (
          <li key={b.title} className="rounded-[28px] border border-line bg-panel p-8 shadow-lift md:p-10">
            <p className="tnum font-display text-7xl font-light leading-none tracking-[-0.05em] text-edge-text">{String(i + 1).padStart(2, "0")}</p>
            <h2 className="mt-5 text-3xl">{b.title}</h2>
            <p className="mt-3 max-w-[52ch] text-lg leading-relaxed text-ink-2">{b.text}</p>
          </li>
        ))}
      </ol>
      <div className="h-20 max-md:hidden" />
    </>
  );
}
