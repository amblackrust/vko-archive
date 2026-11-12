import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import clsx from "clsx";
import { api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { PageHead } from "@/components/ui/page-head";
import { EmptyState } from "@/components/ui/empty-state";
import { toneBg } from "@/lib/tones";

export default async function ExhibitionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ theme?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { theme } = await searchParams;
  const [t, lang] = await Promise.all([getTranslations("exhibitions"), getLocale()]);
  const all = await api.get<Schema["ExhibitionList"]>("/api/exhibitions", { query: { lang } }).catch(() => null);
  const shown = theme ? (all?.items ?? []).filter((e) => e.theme === theme) : (all?.items ?? []);
  const themes = [...new Set((all?.items ?? []).map((e) => e.theme).filter(Boolean))] as string[];
  const chip = (on: boolean) => clsx("inline-flex h-10 items-center rounded-full px-4 font-medium no-underline transition-colors", on ? "bg-ink text-paper" : "bg-mount-2 text-ink-2 hover:text-ink");

  return (
    <>
      <PageHead title={t("title")} actions={
        <nav className="flex flex-wrap gap-2" aria-label={t("title")}>
          <Link href="/exhibitions" className={chip(!theme)}>{t("themes.all")}</Link>
          {themes.map((x) => <Link key={x} href={`/exhibitions?theme=${x}`} className={chip(theme === x)}>{t.has(`themes.${x}`) ? t(`themes.${x}`) : x}</Link>)}
        </nav>
      } />
      {shown.length === 0 ? (
        <div className="wrap"><EmptyState title={t("empty")} /></div>
      ) : (
        // Wide tiles with a photograph; the last odd one spans the whole row.
        <ul className="grid gap-4 px-[var(--gutter)] xl:grid-cols-2">
          {shown.map((e, i) => (
            <li key={e.id} className="xl:last:odd:col-span-2">
              <Link href={e.href} className="group relative flex h-[19rem] flex-col justify-between overflow-hidden rounded-[32px] p-7 text-white no-underline md:h-[22rem] md:p-9" style={{ background: toneBg(i) }}>
                {e.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.cover.preview_url ?? e.cover.url} alt="" loading={i < 2 ? "eager" : "lazy"} className="absolute inset-0 size-full object-cover transition-transform duration-[900ms] ease-(--ease-out) group-hover:scale-[1.06]" />
                )}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/20" />
                <span className="relative inline-flex w-fit rounded-full bg-white/18 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-sm">{e.period}</span>
                <span className="relative">
                  <span className="block max-w-[28ch] font-display text-[clamp(1.75rem,3.2vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em]">{e.title}</span>
                  <span className="mt-3 flex items-center gap-2 text-sm text-white/85">{t("exhibits", { count: e.exhibits_count })}<ArrowUpRight size={17} className="transition-transform duration-300 ease-(--ease-spring) group-hover:-translate-y-1 group-hover:translate-x-1" aria-hidden /></span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
