import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ApiError, api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/ui/page-head";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { DragScroll } from "@/components/ui/drag-scroll";
import { ExhibitWall } from "@/components/exhibition/exhibit-wall";
import { DocActions } from "@/components/document/doc-actions";
import { toneBg } from "@/lib/tones";

export default async function ExhibitionPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const lang = await getLocale();
  const [t, nav] = await Promise.all([getTranslations("exhibitions"), getTranslations("nav.primary")]);
  const ex = await api.get<Schema["ExhibitionDetail"]>(`/api/exhibitions/${slug}`, { query: { lang }, revalidate: 0 }).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const rec = await api.get<Schema["RecommendationsResponse"]>("/api/ai/recommendations", { query: { type: "exhibition", id: ex.id, lang, limit: 8 } }).catch(() => null);

  return (
    <>
      <header className="enter-slow relative mx-[var(--gutter)] mt-3 overflow-hidden rounded-[32px] p-8 text-white md:p-14" style={{ background: toneBg(2) }}>
        {ex.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ex.cover.preview_url ?? ex.cover.url} alt="" className="absolute inset-0 size-full scale-105 object-cover" />
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
        <div className="relative">
          <Breadcrumbs light items={[{ label: nav("exhibitions"), href: "/exhibitions" }, { label: ex.title }]} />
          <div className="mt-24 flex flex-wrap items-end justify-between gap-x-12 gap-y-8">
            <div className="max-w-[60rem]">
              <p className="mb-3"><span className="rounded-full bg-white/18 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-sm">{ex.period}</span></p>
              <h1 className="text-[clamp(2.5rem,6vw,5.25rem)] tracking-[-0.045em]">{ex.title}</h1>
              {ex.intro && <p className="mt-5 max-w-[56ch] text-xl text-white/85">{ex.intro}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2 [&_button]:!bg-white/20 [&_button]:!text-white"><FavoriteButton type="exhibition" id={ex.id} /><DocActions code={null} /></div>
          </div>
        </div>
      </header>
      <div className="py-20 md:py-28"><ExhibitWall exhibits={ex.exhibits} /></div>
      {rec && rec.items.length > 0 && (
        <section>
          <h2 className="wrap mb-5 text-3xl md:text-4xl">{t("related")}</h2>
          <DragScroll label={t("related")} className="gap-4 px-[var(--gutter)] pb-4">
            {rec.items.map((r) => (
              <li key={r.id} className="shrink-0 snap-start"><Link href={r.href} draggable={false} className="flex h-40 w-[17rem] flex-col justify-between rounded-3xl bg-sleeve p-5 text-[oklch(96%_0.005_240)] no-underline transition-transform duration-300 ease-(--ease-spring) hover:-translate-y-1.5"><span className="edge !text-edge">{r.type}</span><span className="font-display text-xl font-medium leading-tight tracking-[-0.02em]">{r.title}</span></Link></li>
            ))}
          </DragScroll>
        </section>
      )}
    </>
  );
}
