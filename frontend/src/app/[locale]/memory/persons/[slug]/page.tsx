import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DocumentList } from "@/components/memory/document-views";
import { EditorialNote, SourceList } from "@/components/memory/source-block";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import { fetchPerson } from "@/lib/api/memory";
import { localizedAlternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const person = await fetchPerson(slug, locale);
  return { title: person?.name, alternates: localizedAlternates(locale, `/memory/persons/${slug}`) };
}

export default async function PersonPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const person = await fetchPerson(slug, locale);
  if (!person) notFound();
  const t = await getTranslations("memory");
  return (
    <>
      <Breadcrumbs items={[{ label: t("breadcrumb"), href: "/memory" }, { label: person.name }]} />
      <div className="container-page max-w-4xl space-y-8 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold" lang={person.name_lang}>
            {person.name}
            {person.translation_missing && <DemoBadge kind="noTranslation" className="ml-2 align-middle" />}
          </h1>
          {person.years_text && <p className="text-muted-foreground">{t("persons.years")}: {person.years_text}</p>}
        </header>

        <section aria-label={t("editorial.label")} className="space-y-3">
          <EditorialNote />
          {person.bio && <p className="whitespace-pre-line text-lg leading-relaxed">{person.bio}</p>}
        </section>

        <SourceList sources={person.sources} headingId="person-sources" />

        <section aria-labelledby="person-docs" className="space-y-3">
          <h2 id="person-docs" className="text-xl font-semibold">{t("person.documents")}</h2>
          {person.documents.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm">
              {t("person.noDocuments")}
            </p>
          ) : (
            <DocumentList items={person.documents} />
          )}
        </section>
        <Link href="/memory" className="inline-block text-primary hover:underline">← {t("person.back")}</Link>
      </div>
    </>
  );
}
