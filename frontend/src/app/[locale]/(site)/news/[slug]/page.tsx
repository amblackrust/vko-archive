import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ApiError, api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/ui/page-head";
import { Prose } from "@/components/ui/prose";
import { Media } from "@/components/ui/media";
import { DocActions } from "@/components/document/doc-actions";
import { FavoriteButton } from "@/components/ui/favorite-button";

export default async function NewsItemPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [t, nav, lang, format] = await Promise.all([getTranslations("news"), getTranslations("nav.primary"), getLocale(), getFormatter()]);
  const n = await api.get<Schema["NewsDetail"]>(`/api/news/${slug}`, { query: { lang }, revalidate: 0 }).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <article>
      <header className="wrap pb-10 pt-10 md:pt-14">
        <Breadcrumbs items={[{ label: nav("news"), href: "/news" }, { label: n.title }]} />
        <p className="mb-4 flex items-center gap-3"><time className="edge" dateTime={n.published_at ?? undefined}>{n.published_at && format.dateTime(new Date(n.published_at), { day: "numeric", month: "long", year: "numeric" })}</time></p>
        <h1 className="max-w-[24ch] text-[clamp(2.5rem,6.4vw,5.5rem)] tracking-[-0.045em]">{n.title}</h1>
        {n.summary && <p className="mt-6 max-w-[60ch] text-2xl text-ink-2">{n.summary}</p>}
        <div className="mt-6 flex flex-wrap gap-2"><FavoriteButton type="news" id={n.id} /><DocActions code={null} /></div>
      </header>
      {n.cover && <div className="wrap mb-10"><Media src={n.cover.preview_url ?? n.cover.url} className="max-h-[60dvh] w-full rounded-[28px] object-cover" loading="eager" /></div>}
      <div className="wrap">
        {/* Long text runs in two columns on wide screens, like a column of print. */}
        <Prose html={n.body} className="!max-w-none xl:columns-2 xl:gap-16 [&>*]:break-inside-avoid-column" />
        {n.related.length > 0 && (
          <section className="mt-16 border-t border-line pt-8">
            <h2 className="mb-4 text-2xl">{t("related")}</h2>
            <ul className="flex flex-wrap gap-3">{n.related.map((r) => <li key={r.href}><Link href={r.href} className="inline-flex h-10 items-center rounded-full bg-table-3 px-4 no-underline hover:text-action">{r.title}</Link></li>)}</ul>
          </section>
        )}
        <Link href="/news" className="mt-12 inline-block text-action">← {t("back")}</Link>
      </div>
    </article>
  );
}
