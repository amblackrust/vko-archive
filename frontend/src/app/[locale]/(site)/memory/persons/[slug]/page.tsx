import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ApiError, api, type Schema } from "@/lib/api/client";
import { PageHead } from "@/components/ui/page-head";
import { DocStrip } from "@/components/memory/doc-strip";

export default async function PersonPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [t, nav, lang] = await Promise.all([getTranslations("memory"), getTranslations("nav.items"), getLocale()]);
  const p = await api.get<Schema["PersonDetail"]>(`/api/memory/persons/${slug}`, { query: { lang }, revalidate: 0 }).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <PageHead title={p.name} crumbs={[{ label: t("title"), href: "/memory" }, { label: nav("persons"), href: "/memory/persons" }, { label: p.name }]}
        meta={<>{p.years_text && <span className="edge">{p.years_text}</span>}</>} />
      <div className="wrap grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <section>
          <h2 className="mb-3 text-2xl">{t("persons.bio")}</h2>
          <p className="max-w-[62ch] whitespace-pre-line text-xl leading-relaxed text-ink-2">{p.bio}</p>
        </section>
        {p.sources.length > 0 && (
          <aside>
            <h2 className="mb-3 text-2xl">{t("persons.sources")}</h2>
            <ul className="space-y-2 text-ink-2">{p.sources.map((s, i) => <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-action">{s.title}</a> : s.title}</li>)}</ul>
          </aside>
        )}
      </div>
      {p.documents.length > 0 && (
        <div className="wrap mt-14">
          <h2 className="mb-4 text-3xl">{t("documents")}</h2>
          <DocStrip docs={p.documents} />
        </div>
      )}
    </>
  );
}
