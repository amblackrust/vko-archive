import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocumentGallery, DocumentRows } from "@/components/memory/documents";
import { themeLabel } from "@/components/memory/labels";
import { DemoBadge } from "@/components/ui/demo-badge";
import { DemoTag } from "@/components/ui/demo-tag";
import { FactList } from "@/components/ui/facts";
import { LinkList } from "@/components/ui/link-list";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableState } from "@/components/ui/state-view";
import { TabsNav } from "@/components/ui/tabs-nav";
import { attempt, fetchCollection } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ view?: string | string[] }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const collection = await attempt(fetchCollection(slug, locale));
  return { title: collection?.title, description: collection?.description || undefined, alternates: localizedAlternates(locale, `/memory/collections/${slug}`) };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const collection = await attempt(fetchCollection(slug, locale));
  if (collection === undefined) return <UnavailableState />;
  if (collection === null) notFound();
  const t = await getTranslations("memory");
  const gallery = (await searchParams).view === "gallery";
  const base = `/memory/collections/${collection.slug}`;
  // Происхождение материалов коллекции — фонды, в которых хранятся её документы.
  const funds = [...new Map(collection.documents.flatMap((doc) => (doc.fund ? [[doc.fund.id, doc.fund] as const] : []))).values()];

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("breadcrumb"), href: "/memory" }, { label: t("collections.title"), href: "/memory#collections" }, { label: collection.title }]}
        title={collection.title}
        titleLang={collection.title_lang}
        lead={collection.description && <p lang={collection.title_lang}>{collection.description}</p>}
        meta={(collection.is_demo || collection.translation_missing) && (
          <>
            {collection.is_demo && <DemoTag />}
            {collection.translation_missing && <DemoBadge kind="noTranslation" />}
          </>
        )}
        aside={
          <FactList
            items={[
              { label: t("collection.theme"), value: collection.theme && themeLabel(t, "themes", collection.theme) },
              { label: t("collection.period"), value: collection.period },
              { label: t("collection.size"), value: t("collections.items", { count: collection.documents.length }) },
            ]}
          />
        }
      >
        <Notice className="max-w-3xl">{t("collection.editorial")}</Notice>
      </PageHeader>

      <div className="container-page space-y-10 py-6 pb-16">
        <section aria-labelledby="documents" className="space-y-4">
          <h2 id="documents" className="text-2xl">{t("collection.documents")}</h2>
          {collection.documents.length === 0 ? (
            <p className="card p-6 text-muted-foreground">
              {t("collection.none")} <Link href="/catalog" className="text-link">{t("collection.toCatalog")}</Link>
            </p>
          ) : (
            <>
              <TabsNav
                label={t("collection.view")}
                active={gallery ? "gallery" : "list"}
                items={[
                  { id: "list", href: `${base}#documents`, label: t("collection.list") },
                  { id: "gallery", href: `${base}?view=gallery#documents`, label: t("collection.gallery") },
                ]}
              />
              {gallery ? <DocumentGallery items={collection.documents} /> : <DocumentRows items={collection.documents} />}
            </>
          )}
        </section>

        {funds.length > 0 && (
          <section aria-labelledby="collection-sources" className="max-w-3xl space-y-4">
            <h2 id="collection-sources" className="text-2xl">{t("collection.sources")}</h2>
            <p className="text-muted-foreground">{t("collection.sourcesText")}</p>
            <LinkList items={funds.map((fund) => ({ href: fund.href, label: t("collection.fund", { number: fund.number, title: fund.title }) }))} />
          </section>
        )}
      </div>
    </>
  );
}
