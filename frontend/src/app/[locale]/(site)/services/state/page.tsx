import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { PageHead } from "@/components/ui/page-head";
import { LinkRows } from "@/components/ui/link-rows";
import { buttonClass } from "@/components/ui/button";

export default async function StateServicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nav] = await Promise.all([getTranslations("info.state"), getTranslations("nav.groups")]);
  const steps = t.raw("stepList") as string[];
  const docs = t.raw("items") as { title: string; url: string }[];
  return (
    <>
      <PageHead title={t("title")} lead={t("lead")} crumbs={[{ label: nav("services") }, { label: t("title") }]}
        actions={<><a href="https://egov.kz" target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>{t("egov")} <ArrowUpRight size={15} aria-hidden /></a><a href="https://eotinish.kz" target="_blank" rel="noopener noreferrer" className={buttonClass("outline")}>{t("eotinish")} <ArrowUpRight size={15} aria-hidden /></a></>} />
      <section className="wrap mb-20">
        <h2 className="mb-8 text-3xl md:text-4xl">{t("steps")}</h2>
        {/* Steps along one dotted path. */}
        <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
          <span aria-hidden className="absolute left-0 right-0 top-6 hidden border-t-2 border-dotted border-line-strong md:block" />
          {steps.map((s, i) => (
            <li key={i} className="relative">
              <span className="relative mb-5 grid size-12 place-items-center rounded-full bg-ink font-display text-xl font-semibold text-table">{i + 1}</span>
              <p className="max-w-[34ch] text-xl leading-snug">{s}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-[60ch] text-ink-3">{t("reports")}</p>
      </section>
      <section className="wrap">
        <h2 className="mb-4 text-3xl md:text-4xl">{t("docs")}</h2>
        <LinkRows rows={docs.map((d) => ({ title: d.title, href: d.url, external: true }))} />
      </section>
    </>
  );
}
