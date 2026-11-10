import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DocumentGallery, DocumentList } from "@/components/memory/document-views";
import { themeLabel } from "@/components/memory/theme-label";
import { EditorialNote } from "@/components/memory/source-block";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import { fetchCollection } from "@/lib/api/memory";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ view?: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const collection = await fetchCollection(slug, locale);
  return { title: collection?.title };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const { view } = await searchParams;
  const collection = await fetchCollection(slug, locale);
  if (!collection) notFound();
  const t = await getTranslations("memory");
  const gallery = view === "gallery";
  const tab = (active: boolean) =>
    cn("inline-flex min-h-9 items-center rounded-md border px-3 text-sm", active ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-surface-muted");
  return (
    <>
      <Breadcrumbs items={[{ label: t("breadcrumb"), href: "/memory" }, { label: collection.title }]} />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold" lang={collection.title_lang}>
            {collection.title}
            {collection.is_demo && <DemoBadge className="ml-3 align-middle" />}
            {collection.translation_missing && <DemoBadge kind="noTranslation" className="ml-2 align-middle" />}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[collection.theme && themeLabel(t, collection.theme), collection.period].filter(Boolean).join(" · ")}
          </p>
          {collection.description && <p className="max-w-3xl">{collection.description}</p>}
          <div className="max-w-3xl"><EditorialNote /></div>
        </header>

        <section aria-labelledby="docs-title" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="docs-title" className="text-xl font-semibold">{t("collection.documents")}</h2>
            <div role="group" aria-label={t("collection.view")} className="flex gap-2">
              <Link href={`/memory/collections/${slug}`} aria-current={!gallery ? "true" : undefined} className={tab(!gallery)}>{t("collection.list")}</Link>
              <Link href={`/memory/collections/${slug}?view=gallery`} aria-current={gallery ? "true" : undefined} className={tab(gallery)}>{t("collection.gallery")}</Link>
            </div>
          </div>
          {collection.documents.length === 0 ? (
            <p className="rounded-lg border p-4">{t("collection.none")}</p>
          ) : gallery ? (
            <DocumentGallery items={collection.documents} />
          ) : (
            <DocumentList items={collection.documents} />
          )}
        </section>
        <Link href="/memory" className="inline-block text-primary hover:underline">← {t("collection.back")}</Link>
      </div>
    </>
  );
}
