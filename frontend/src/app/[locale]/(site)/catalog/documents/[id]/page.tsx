import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, Lock } from "lucide-react";
import { ApiError, api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/ui/page-head";
import { AccessBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { DragScroll } from "@/components/ui/drag-scroll";
import { DocumentStage } from "@/components/document/document-stage";
import { DocAiPanel } from "@/components/document/doc-ai-panel";
import { DocActions } from "@/components/document/doc-actions";
import { generateDocMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  return generateDocMeta(id, locale);
}

export default async function DocumentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const lang = await getLocale();
  const [t, d, c, nav] = await Promise.all([getTranslations("document"), getTranslations("dict"), getTranslations("common"), getTranslations("nav.primary")]);

  const doc = await api.get<Schema["DocumentDetail"]>(`/api/catalog/documents/${id}`, { query: { lang }, revalidate: 0 }).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const rec = await api.get<Schema["RecommendationsResponse"]>("/api/ai/recommendations", { query: { type: "document", id, lang, limit: 8 } }).catch(() => null);

  const open = doc.file_access === "open" && (doc.files?.length ?? 0) > 0;
  const path = [
    { label: doc.fund ? `${doc.fund.number}` : "", href: doc.fund ? `/catalog?fund=${doc.fund.id}` : undefined },
    ...(doc.inventory ? [{ label: `${doc.inventory.number}`, href: `/catalog?fund=${doc.fund?.id}&inventory=${doc.inventory.id}` }] : []),
    ...(doc.case ? [{ label: `${doc.case.number}`, href: `/catalog?fund=${doc.fund?.id}&inventory=${doc.inventory?.id}&case=${doc.case.id}&doc=${doc.id}` }] : []),
  ].filter((x) => x.label);

  const facts: [string, React.ReactNode][] = [
    [t("fields.code"), <span key="c" className="code">{doc.archive_code}</span>],
    [t("fields.date"), doc.date_text],
    [t("fields.type"), doc.doc_type ? (d.has(`docType.${doc.doc_type}`) ? d(`docType.${doc.doc_type}`) : doc.doc_type) : null],
    [t("fields.places"), doc.places?.join(", ")],
    [t("fields.authors"), doc.authors],
    [t("fields.sheets"), doc.sheets_count],
    [t("fields.language"), doc.language ? (d.has(`language.${doc.language}`) ? d(`language.${doc.language}`) : doc.language) : null],
    [t("fields.branch"), [doc.branch, doc.storage_location].filter(Boolean).join(" · ")],
  ];

  const aiPanel = <DocAiPanel id={doc.id} />;

  return (
    <article>
      <header className="wrap pb-6 pt-8 md:pt-10">
        <Breadcrumbs items={[{ label: nav("catalog"), href: "/catalog" }, ...(doc.fund ? [{ label: `${doc.fund.number} · ${doc.fund.title}`, href: `/catalog?fund=${doc.fund.id}` }] : []), ...(doc.case ? [{ label: doc.case.title }] : [])]} />
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div className="min-w-0 max-w-[62rem]">
            <div className="mb-3 flex flex-wrap items-center gap-2"><AccessBadge access={doc.file_access} /></div>
            <h1 className="text-[clamp(2rem,4.6vw,3.75rem)] tracking-[-0.035em]">{doc.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FavoriteButton type="document" id={doc.id} />
            <DocActions code={doc.archive_code} />
          </div>
        </div>
      </header>

      {open ? (
        <DocumentStage files={doc.files ?? []} title={doc.title} drawer={aiPanel} />
      ) : (
        <div className="mx-[var(--gutter)] grid min-h-[22rem] place-items-center rounded-[32px] bg-sleeve p-10 text-center text-[oklch(96%_0.005_240)]">
          <div className="max-w-[44rem]">
            <Lock size={30} strokeWidth={1.4} className="mx-auto mb-5 text-edge" aria-hidden />
            <h2 className="text-3xl md:text-4xl">{doc.has_digital_copy ? t("restricted.title") : t("noCopy")}</h2>
            {doc.has_digital_copy && <p className="mx-auto mt-4 max-w-[56ch] opacity-80">{doc.access_conditions || t("restricted.text")}</p>}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/services/state" className={buttonClass("primary")}>{t("restricted.service")}</Link>
              <a href="https://egov.kz" target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "!border-white/40 !text-inherit hover:!bg-white/10")}>eGov.kz <ArrowUpRight size={15} aria-hidden /></a>
            </div>
          </div>
        </div>
      )}

      <div className="wrap mt-12">
        <dl className="grid grid-cols-1 border-y border-line sm:grid-cols-2 md:grid-flow-col md:auto-cols-fr md:grid-cols-none">
          {facts.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
            <div key={k} className="min-w-0 border-line px-5 py-4 max-md:border-b max-md:last:border-b-0 md:border-r md:first:pl-0 md:last:border-r-0">
              <dt className="edge">{k}</dt>
              <dd className="mt-1 font-display text-lg font-medium tracking-[-0.015em] [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
        {path.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-3">
            {path.map((p, i) => (<span key={i} className="flex items-center gap-2">{i > 0 && <span aria-hidden>›</span>}{p.href ? <Link href={p.href} className="edge no-underline hover:underline">{p.label}</Link> : p.label}</span>))}
          </p>
        )}
      </div>

      <div className="wrap mt-14 grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div>
          {doc.summary && (<section><h2 className="mb-3 text-2xl">{t("fields.summary")}</h2><p className="max-w-[62ch] text-xl leading-relaxed text-ink-2">{doc.summary}</p></section>)}
          {doc.historical_note && (<section className="mt-10"><h2 className="mb-3 text-2xl">{t("fields.note")}</h2><p className="max-w-[62ch] leading-relaxed text-ink-2">{doc.historical_note}</p></section>)}
          {doc.annotation && (
            <section className="glass mt-10 max-w-[62ch] rounded-3xl border border-line p-6">
              <h2 className="mb-2 text-lg font-semibold">{t("annotation")}</h2>
              <p className="leading-relaxed">{doc.annotation.text}</p>
              <p className="mt-3 text-xs text-ink-3">{t("annotationAi")}</p>
            </section>
          )}
          {(doc.tags?.length ?? 0) > 0 && (
            <ul className="mt-10 flex flex-wrap gap-2" aria-label={t("fields.tags")}>
              {doc.tags.map((tag) => (<li key={tag.id}><Link href={`/catalog?topic=${tag.id}`} className="inline-flex h-9 items-center rounded-full border border-line-strong/60 px-4 text-sm no-underline hover:border-action hover:text-action">{tag.name}</Link></li>))}
            </ul>
          )}
        </div>
        {!open && <aside>{aiPanel}</aside>}
      </div>

      {rec && rec.items.length > 0 && (
        <section className="mt-20">
          <h2 className="wrap mb-5 text-3xl md:text-4xl">{t("related")}</h2>
          <DragScroll label={t("related")} className="gap-4 px-[var(--gutter)] pb-4">
            {rec.items.map((r) => (
              <li key={r.id} className="shrink-0 snap-start">
                <Link href={r.href} draggable={false} className="flex h-44 w-[18rem] flex-col justify-between rounded-3xl bg-sleeve p-5 text-[oklch(96%_0.005_240)] no-underline transition-transform duration-300 ease-(--ease-spring) hover:-translate-y-1.5">
                  <span className="edge !text-edge">{r.document?.archive_code ?? c(`types.${r.type}` as never)}</span>
                  <span className="font-display text-xl font-medium leading-tight tracking-[-0.02em]">{r.title}</span>
                </Link>
              </li>
            ))}
          </DragScroll>
        </section>
      )}
    </article>
  );
}
