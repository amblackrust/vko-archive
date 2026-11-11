import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocumentRows, DocumentTiles } from "@/components/memory/documents";
import { themeLabel } from "@/components/memory/labels";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableState } from "@/components/ui/state-view";
import { TabsNav } from "@/components/ui/tabs-nav";
import { attempt, fetchCollection } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ view?: string | string[] }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const collection = await attempt(fetchCollection(slug, locale));
  return { title: collection?.title, description: collection?.description || undefined, alternates: localizedAlternates(locale, `/memory/collections/${slug}`) };
}

/** Коллекция: описание и сведения одной карточкой, ниже — документы плиткой с изображениями (или списком). */
export default async function CollectionPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const collection = await attempt(fetchCollection(slug, locale));
  if (collection === undefined) return <UnavailableState />;
  if (collection === null) notFound();
  const t = await getTranslations("memory");
  const list = (await searchParams).view === "list";
  const base = `/memory/collections/${collection.slug}`;
  // Происхождение материалов коллекции — фонды, в которых хранятся её документы.
  const funds = [...new Map(collection.documents.flatMap((doc) => (doc.fund ? [[doc.fund.id, doc.fund] as const] : []))).values()];
  const facts = [
    { label: t("collection.theme"), value: collection.theme && themeLabel(t, "themes", collection.theme) },
    { label: t("collection.period"), value: collection.period },
    { label: t("collection.size"), value: collection.documents.length > 0 && t("collections.items", { count: collection.documents.length }) },
  ].filter((fact) => fact.value);

  const sources = funds.length > 0 && (
    <section aria-labelledby="collection-sources">
      <h2 id="collection-sources" className="text-sm font-normal text-muted-foreground">{t("collection.sources")}</h2>
      <ul className="mt-1 space-y-1.5 text-[0.9375rem]">
        {funds.map((fund) => (
          <li key={fund.id}><Link href={fund.href} className="text-link">{t("collection.fund", { number: fund.number, title: fund.title })}</Link></li>
        ))}
      </ul>
    </section>
  );

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("breadcrumb"), href: "/memory" }, { label: t("collections.title"), href: "/memory#collections" }, { label: collection.title }]}
        title={collection.title}
        titleLang={collection.title_lang}
      />

      <div className="container-page space-y-12 pb-16">
        <div className={cn("card grid overflow-hidden", collection.description && "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
          {collection.description && (
            <div className="flex flex-col gap-6 p-6 sm:p-8">
              <p className="reading max-w-3xl whitespace-pre-line" lang={collection.title_lang}>{collection.description}</p>
              {sources && <div className="mt-auto border-t pt-5">{sources}</div>}
            </div>
          )}
          <div className={cn("p-6 sm:p-8", collection.description && "border-t lg:border-l lg:border-t-0")}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-1">
              {facts.map((fact) => (
                <div key={fact.label} className="last:odd:col-span-2 lg:last:odd:col-span-1">
                  <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{fact.value}</dd>
                </div>
              ))}
            </dl>
            {!collection.description && sources && <div className="mt-6 border-t pt-5">{sources}</div>}
          </div>
        </div>

        {collection.documents.length > 0 && (
          <section aria-labelledby="documents">
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
              <h2 id="documents" className="scroll-mt-28 text-2xl sm:text-3xl">{t("collection.documents")}</h2>
              <TabsNav
                label={t("collection.view")}
                active={list ? "list" : "gallery"}
                items={[
                  { id: "gallery", href: `${base}#documents`, label: t("collection.gallery") },
                  { id: "list", href: `${base}?view=list#documents`, label: t("collection.list") },
                ]}
              />
            </div>
            <div className="mt-6">
              {list ? (
                <DocumentRows items={collection.documents} />
              ) : (
                <DocumentTiles
                  items={collection.documents}
                  closing={<LinkTile accent href="/memory#collections" title={t("collection.others")} text={t("collection.othersText")} />}
                />
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
