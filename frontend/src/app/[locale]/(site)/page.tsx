import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { api, type Schema } from "@/lib/api/client";
import { HeroSearch } from "@/components/home/hero-search";
import { Strip } from "@/components/home/strip";
import { SectionHead } from "@/components/home/section-head";
import { HomeBranches } from "@/components/home/home-branches";
import { Stamp, type StampTone } from "@/components/ui/stamp";

const CATEGORY_ORDER = ["historical", "written", "photos", "maps", "organizations", "personal", "audio_video"];
const PLACES = ["ustkam", "altai", "irtysh", "markakol", "katon", "zhangyskol"] as const;
const TONES: StampTone[] = ["action", "ochre", "postmark", "sage"];
// Photo stamps are landscape, ink stamps portrait: one baseline, varied widths.
const PHOTO = "h-[20rem] w-[27rem] md:h-[24rem] md:w-[33rem]";
const INK = "h-[20rem] w-[15rem] md:h-[24rem] md:w-[17.5rem]";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = await getLocale();
  const [t, format] = await Promise.all([getTranslations("home"), getFormatter()]);

  const [catalog, exhibitions, collections, news, branches, dates] = await Promise.all([
    api.get<Schema["DocumentsResponse"]>("/api/catalog/documents", { query: { per_page: 1 } }).catch(() => null),
    api.get<Schema["ExhibitionList"]>("/api/exhibitions", { query: { lang } }).catch(() => null),
    api.get<Schema["CollectionsResponse"]>("/api/memory/collections", { query: { lang } }).catch(() => null),
    api.get<Schema["NewsList"]>("/api/news", { query: { lang, per_page: 4 } }).catch(() => null),
    api.get<Schema["BranchesResponse"]>("/api/branches", { query: { lang } }).catch(() => null),
    api.get<Schema["MemorialDatesResponse"]>("/api/home/memorial-dates", { query: { lang } }).catch(() => null),
  ]);

  const counts = new Map((catalog?.facets.category ?? []).map((f) => [f.value, f.count]));
  const categories = CATEGORY_ORDER.filter((key) => counts.has(key));
  const monthName = dates?.month ? format.dateTime(new Date(dates.year, dates.month - 1, 1), { month: "long" }) : "";

  // The shelf alternates photo stamps (places, search shortcuts) and ink stamps (exhibitions, collections).
  const ink = [
    ...(exhibitions?.items ?? []).map((e) => ({
      href: e.href,
      title: e.title,
      figure: e.period ?? undefined,
      note: t("exhibitions.items", { count: e.exhibits_count }),
    })),
    ...(collections?.items ?? []).map((c) => ({
      href: c.href,
      title: c.title,
      figure: c.period ?? undefined,
      note: t("items", { count: c.item_count }),
    })),
  ];
  const shelf: React.ReactNode[] = [];
  const longest = Math.max(PLACES.length, ink.length);
  let n = 0;
  for (let i = 0; i < longest; i++) {
    if (i < PLACES.length) {
      const name = t(`places.${PLACES[i]}`);
      shelf.push(
        <Stamp key={`p-${PLACES[i]}`} index={n++} className={PHOTO} href={`/search?q=${encodeURIComponent(name)}`} title={name} image={`/photos/${PLACES[i]}.webp`} />,
      );
    }
    if (i < ink.length) {
      const item = ink[i];
      shelf.push(<Stamp key={`i-${item.href}`} index={n++} className={INK} tone={TONES[i % TONES.length]} {...item} />);
    }
  }

  return (
    <>
      <section className="pb-6 pt-12 md:pt-16">
        <div className="wrap">
          <h1 className="max-w-[15ch] text-[clamp(2.75rem,7.2vw,6rem)]">{t("title")}</h1>
          <div className="mt-8 max-w-[68rem] md:mt-10">
            <HeroSearch examples={t.raw("examples") as string[]} />
          </div>
        </div>
        <div className="mt-16 md:mt-[4.5rem]">
          <Strip label={t("strip")} prevLabel={t("stripPrev")} nextLabel={t("stripNext")}>
            {shelf}
          </Strip>
        </div>
      </section>

      <section className="wrap grid items-start gap-x-14 gap-y-8 py-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div className="lg:sticky lg:top-24">
          <SectionHead title={t("catalog.title")} href="/catalog" linkLabel={t("catalog.all")} />
        </div>
        <ul>
          {categories.map((key) => (
            <li key={key} className="border-b border-frame first:border-t">
              <Link
                href={`/catalog?category=${key}`}
                className="group -mx-4 flex items-center gap-5 rounded-2xl px-4 py-5 no-underline transition-colors hover:bg-mount md:gap-8"
              >
                <span className="tnum w-20 shrink-0 font-display text-5xl leading-none tracking-[-0.04em] text-action md:w-28 md:text-6xl">
                  {counts.get(key)}
                </span>
                <span className="flex-1 text-xl font-semibold tracking-[-0.015em] md:text-[1.65rem]">{t(`catalog.categories.${key}`)}</span>
                <ArrowRight size={22} className="text-ink-3 transition-transform duration-300 ease-(--ease-spring) group-hover:translate-x-1.5 group-hover:text-action" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap py-10">
        <div className="grid gap-x-14 gap-y-8 rounded-[32px] bg-mount-2 p-8 md:p-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <h2 className="text-4xl md:text-5xl">{t("today.title")}</h2>
            <p className="mt-4 font-display text-5xl capitalize text-postmark md:text-6xl">{monthName}</p>
            <Link href="/calendar" className="mt-6 inline-flex h-11 items-center gap-1.5 rounded-full bg-paper px-5 text-sm font-semibold no-underline shadow-lift transition-transform duration-200 ease-(--ease-spring) hover:-translate-y-0.5 active:scale-95">
              {t("today.all")} <ArrowUpRight size={15} aria-hidden />
            </Link>
          </div>
          <ul className="self-center">
            {(dates?.items ?? []).slice(0, 4).map((item, i) => (
              <li key={i} className="flex items-baseline gap-5 border-b border-frame py-4 first:pt-0 last:border-0">
                <span className="tnum font-display text-4xl leading-none tracking-[-0.03em] text-action">{item.event_year}</span>
                <span className="text-lg text-ink-2">{item.text}</span>
              </li>
            ))}
            {!dates?.items.length && <li className="py-4 text-lg text-ink-3">{t("today.empty")}</li>}
          </ul>
        </div>
      </section>

      <section className="wrap py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl md:text-5xl">{t("news.title")}</h2>
          <Link href="/news" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-mount-2 px-4 text-sm font-semibold text-ink-2 no-underline transition-[background-color,color,transform] duration-200 ease-(--ease-spring) hover:bg-action hover:text-action-ink active:scale-95">{t("news.all")} <ArrowUpRight size={15} aria-hidden /></Link>
        </div>
        <ul>
          {(news?.items ?? []).slice(0, 4).map((item, i) => (
            <li key={item.id} className="border-b border-frame first:border-t">
              <Link href={item.href} className="group -mx-4 flex items-baseline gap-6 rounded-2xl px-4 py-5 no-underline transition-colors hover:bg-mount">
                <time dateTime={item.published_at ?? undefined} className="tnum w-36 shrink-0 whitespace-nowrap text-ink-3">
                  {item.published_at && format.dateTime(new Date(item.published_at), { day: "numeric", month: "short", year: "numeric" })}
                </time>
                <span className={i === 0 ? "font-display text-3xl md:text-4xl" : "font-display text-xl md:text-2xl"}>{item.title}</span>
                <ArrowUpRight size={20} className="ml-auto hidden shrink-0 self-center text-ink-3 transition-transform duration-300 ease-(--ease-spring) group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-action md:block" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {branches && <HomeBranches branches={branches.items} title={t("branches.title")} allLabel={t("branches.all")} />}

      <section className="wrap">
        <div className="flex flex-wrap items-center justify-between gap-x-12 gap-y-6 rounded-[32px] bg-action px-8 py-12 text-action-ink md:px-16 md:py-16">
          <div>
            <h2 className="text-4xl md:text-5xl">{t("help.title")}</h2>
            <p className="mt-3 max-w-[46ch] text-lg opacity-90">{t("help.text")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="https://egov.kz" target="_blank" rel="noopener noreferrer" className="inline-flex h-14 items-center gap-2 rounded-full bg-paper px-8 text-lg font-bold text-ink no-underline transition-[transform,box-shadow] duration-200 ease-(--ease-spring) hover:-translate-y-0.5 active:scale-95">
              {t("help.egov")}
              <ArrowUpRight size={18} aria-hidden />
            </a>
            <Link href="/services/state" className="inline-flex h-14 items-center rounded-full border-2 border-current px-8 text-lg font-bold no-underline transition-[background-color,transform] duration-200 ease-(--ease-spring) hover:bg-white/15 active:scale-95">
              {t("help.guide")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
