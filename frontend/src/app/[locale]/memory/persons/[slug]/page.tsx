import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MediaImage } from "@/components/exhibitions/media-image";
import { DocumentRows } from "@/components/memory/documents";
import { Sources, UnconfirmedTag } from "@/components/memory/provenance";
import { DemoBadge } from "@/components/ui/demo-badge";
import { DemoTag } from "@/components/ui/demo-tag";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableState } from "@/components/ui/state-view";
import { fileUrl } from "@/lib/api/document";
import { attempt, fetchPerson } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const person = await attempt(fetchPerson(slug, locale));
  return { title: person && [person.name, person.years_text].filter(Boolean).join(", "), alternates: localizedAlternates(locale, `/memory/persons/${slug}`) };
}

export default async function PersonPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const person = await attempt(fetchPerson(slug, locale));
  if (person === undefined) return <UnavailableState />;
  if (person === null) notFound();
  const t = await getTranslations("memory");
  const confirmed = person.documents.length > 0;
  // Отдельного поля «портрет» в API нет: в шапке показывается первая привязанная фотография с открытой копией.
  const portrait = person.documents.find((doc) => doc.doc_type === "photo" && doc.preview_url);

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("breadcrumb"), href: "/memory" }, { label: t("people.title"), href: "/memory#persons" }, { label: person.name }]}
        title={person.name}
        titleLang={person.name_lang}
        lead={person.years_text && <p className="tabular-nums">{person.years_text}</p>}
        meta={(person.is_demo || person.translation_missing || !confirmed) && (
          <>
            {person.is_demo && <DemoTag />}
            {person.translation_missing && <DemoBadge kind="noTranslation" />}
            {!confirmed && <UnconfirmedTag />}
          </>
        )}
        aside={portrait && (
          <figure className="w-56 lg:justify-self-end">
            <MediaImage src={fileUrl(portrait.preview_url!)} alt="" fallback={t("documents.noImage")} eager className="aspect-[3/4]" />
            <figcaption className="mt-2 text-sm text-muted-foreground">
              <Link href={portrait.href} className="text-link">{portrait.title}</Link>
              {portrait.authors && <span className="mt-0.5 block">{portrait.authors}</span>}
            </figcaption>
          </figure>
        )}
      />
      <div className="container-page grid gap-8 py-6 pb-16 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="person-bio" className="space-y-4">
            <h2 id="person-bio" className="text-2xl">{t("person.bio")}</h2>
            <div className="card space-y-4 p-6 sm:p-8">
              {person.bio ? (
                <>
                  <p className="reading max-w-3xl whitespace-pre-line" lang={person.name_lang}>{person.bio}</p>
                  <p className="border-l-2 border-accent pl-3 text-sm text-muted-foreground">{t("person.editorial")}</p>
                </>
              ) : (
                <p className="text-muted-foreground">{t("person.noBio")}</p>
              )}
            </div>
          </section>

          <section aria-labelledby="person-documents" className="space-y-4">
            <h2 id="person-documents" className="text-2xl">{t("person.documents")}</h2>
            {confirmed ? (
              <DocumentRows items={person.documents} />
            ) : (
              <p className="card p-6 text-muted-foreground">
                {t("person.noDocuments")}{" "}
                <Link href={`/search?q=${encodeURIComponent(person.name)}`} className="text-link">{t("person.search")}</Link>
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-6 self-start lg:sticky lg:top-28">
          <section aria-labelledby="person-sources" className="card space-y-3 p-5">
            <h2 id="person-sources" className="text-base">{t("person.sources")}</h2>
            <Sources items={person.sources} />
            <p className="text-sm text-muted-foreground">{t("person.sourcesText")}</p>
          </section>
          <p><Link href="/memory#persons" className="text-link font-medium">{t("person.all")}</Link></p>
        </aside>
      </div>
    </>
  );
}
