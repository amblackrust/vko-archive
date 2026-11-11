import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AboutNav } from "@/components/about/about-nav";
import { historyPeriods, type HistoryPeriod } from "@/components/about/history";
import { TranslationNote } from "@/components/help/translation-note";
import { heroPhoto } from "@/components/home/hero-photo";
import { safe } from "@/components/misc/api";
import { RichText } from "@/components/misc/rich-text";
import { Unavailable } from "@/components/misc/state-help";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { fetchPage, pageSeo } from "@/lib/api/content";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about.history" });
  const page = await safe(fetchPage("history", locale));
  return { title: t("title"), description: t("lead"), ...(page?.lang === locale ? pageSeo(page) : {}), alternates: localizedAlternates(locale, "/about/history") };
}

/** Запись хроники: год и все абзацы до следующего названного года. */
function entries(period: HistoryPeriod) {
  const out: { year: number | null; html: string }[] = [];
  for (const block of period.blocks) {
    if (block.year || out.length === 0) out.push({ year: block.year, html: block.html });
    else out[out.length - 1].html += block.html;
  }
  return out;
}

/** Годы десятилетия, названные в тексте: «1940–1946» или один год. */
function yearRange(period: HistoryPeriod) {
  const years = period.blocks.flatMap((block) => (block.year ? [block.year] : []));
  if (years.length === 0) return null;
  const [from, to] = [Math.min(...years), Math.max(...years)];
  return from === to ? String(from) : `${from}–${to}`;
}

/**
 * Историческая справка хроникой: слева оглавление по десятилетиям, справа — десятилетие за десятилетием,
 * каждый названный в тексте год вынесен отметкой на поле. Текст приходит из CMS одним полотном.
 */
export default async function HistoryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const page = await fetchPage("history", locale).catch(() => undefined);
  if (page === undefined) return <Unavailable />;
  if (!page) notFound();
  const periods = historyPeriods(page.body);
  const label = (decade: number) => (decade ? t("history.decade", { decade }) : t("history.opening"));

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("title"), href: "/about" }, { label: t("history.title") }]}
        title={page.lang === locale ? page.title : t("history.title")}
        lead={t("history.lead")}
      />
      <AboutNav active="history" />
      <div className="container-page space-y-14 pb-16 pt-8">
        <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          {periods && (
            <nav aria-labelledby="history-toc" className="self-start lg:sticky lg:top-28">
              <h2 id="history-toc" className="mb-3 text-base">{t("history.toc")}</h2>
              <ul className="flex flex-wrap gap-2 lg:block lg:divide-y lg:rounded-lg lg:bg-surface lg:px-5 lg:shadow-card">
                {periods.map((period) => (
                  <li key={period.decade}>
                    <a
                      href={`#y${period.decade}`}
                      className="group flex min-h-11 items-baseline justify-between gap-3 rounded-md border bg-surface px-3 py-2.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-3"
                    >
                      <span className="font-semibold group-hover:text-primary group-hover:underline">{label(period.decade)}</span>
                      <span className="hidden text-sm tabular-nums text-muted-foreground lg:inline">{yearRange(period)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <article className={periods ? "min-w-0 space-y-6" : "min-w-0 space-y-6 lg:col-span-2"}>
            <TranslationNote requested={locale} actual={page.lang} status={page.translation_status} />
            <figure className="relative h-56 overflow-hidden rounded-3xl bg-surface-muted shadow-card sm:h-80">
              <Image src={heroPhoto.src} alt="" fill priority sizes="(min-width: 1024px) 60rem, 100vw" className="object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#152040]/85 to-transparent px-5 pb-3 pt-10 text-xs text-white sm:px-8">
                {t("photo", { author: heroPhoto.author, license: heroPhoto.license })}
              </figcaption>
            </figure>

            {!periods && <div className="card p-6 sm:p-10"><RichText html={page.body} lang={page.lang} /></div>}
            {periods?.map((period) => (
              <section key={period.decade} id={`y${period.decade}`} aria-labelledby={`y${period.decade}-title`} className="card scroll-mt-28 p-6 sm:p-10">
                <h2 id={`y${period.decade}-title`} className="text-2xl sm:text-3xl">{label(period.decade)}</h2>
                <div className="mt-6 divide-y border-t" lang={page.lang}>
                  {entries(period).map((entry, index) => (
                    <div key={index} className="grid gap-x-8 gap-y-2 py-6 last:pb-0 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
                      {entry.year && <p className="text-2xl font-bold tabular-nums leading-8 text-primary">{entry.year}</p>}
                      <RichText html={entry.html} className="sm:col-start-2" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </article>
        </div>

        <nav aria-labelledby="history-more">
          <h2 id="history-more" className="text-2xl sm:text-3xl">{t("history.more")}</h2>
          <ul className="mt-6 grid auto-rows-fr gap-4 md:grid-cols-3">
            <li><LinkTile href="/about/structure" title={t("sections.structure.label")} text={t("sections.structure.text")} /></li>
            <li><LinkTile href="/branches" title={t("sections.branches.label")} text={t("sections.branches.text")} /></li>
            <li><LinkTile href="/memory/timeline" title={t("history.timeline")} text={t("history.timelineText")} /></li>
          </ul>
        </nav>
      </div>
    </>
  );
}
