import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocumentRows, DocumentTiles } from "@/components/memory/documents";
import { PersonCard } from "@/components/memory/person-card";
import { Sources } from "@/components/memory/provenance";
import { Button } from "@/components/ui/button";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableState } from "@/components/ui/state-view";
import { fileUrl } from "@/lib/api/document";
import { attempt, fetchPerson, fetchPersons, type MemoryDocument } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const person = await attempt(fetchPerson(slug, locale));
  return { title: person && [person.name, person.years_text].filter(Boolean).join(", "), alternates: localizedAlternates(locale, `/memory/persons/${slug}`) };
}

/** Отдельного поля «портрет» в API нет: портретом служит первая привязанная фотография с открытой копией. */
const portraitOf = (documents: MemoryDocument[] = []) => documents.find((doc) => doc.doc_type === "photo" && doc.preview_url);

/** Биография: портрет крупно рядом со справкой и источниками сведений, ниже — документы архива и другие личности. */
export default async function PersonPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [person, everyone] = await Promise.all([attempt(fetchPerson(slug, locale)), attempt(fetchPersons(locale))]);
  if (person === undefined) return <UnavailableState />;
  if (person === null) notFound();
  const t = await getTranslations("memory");
  const portrait = portraitOf(person.documents);
  const others = (everyone ?? []).filter((item) => item.slug !== person.slug).slice(0, 4);
  const otherPortraits = await Promise.all(others.map(async (item) => portraitOf((await attempt(fetchPerson(item.slug, locale)))?.documents)?.preview_url));

  const sources = person.sources.length > 0 && (
    <section aria-labelledby="person-sources">
      <h2 id="person-sources" className="mb-2 text-base">{t("person.sources")}</h2>
      <Sources items={person.sources} />
    </section>
  );
  const bio = (
    <section aria-labelledby="person-bio">
      <h2 id="person-bio" className="text-2xl">{t("person.bio")}</h2>
      {person.bio && <p className="reading mt-4 max-w-3xl whitespace-pre-line" lang={person.name_lang}>{person.bio}</p>}
      <p className="mt-6">
        <Button asChild variant="outline"><Link href={`/search?q=${encodeURIComponent(person.name)}`}>{t("person.search")}</Link></Button>
      </p>
    </section>
  );

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("breadcrumb"), href: "/memory" }, { label: t("people.title"), href: "/memory#persons" }, { label: person.name }]}
        title={person.name}
        titleLang={person.name_lang}
        lead={person.years_text && <p className="tabular-nums">{person.years_text}</p>}
      />
      <div className="container-page space-y-12 pb-16">
        {portrait ? (
          <div className="card grid overflow-hidden md:grid-cols-[18rem_minmax(0,1fr)] lg:grid-cols-[24rem_minmax(0,1fr)]">
            <figure className="flex flex-col">
              {/* eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав */}
              <img src={fileUrl(portrait.preview_url!)} alt={portrait.title} className="aspect-[3/4] w-full flex-1 bg-surface-muted object-cover md:aspect-auto md:min-h-[26rem]" />
              <figcaption className="px-6 py-4 text-sm text-muted-foreground">
                <Link href={portrait.href} className="text-link" lang={portrait.title_lang}>{portrait.title}</Link>
                {portrait.authors && <span className="mt-0.5 block">{portrait.authors}</span>}
              </figcaption>
            </figure>
            <div className="flex flex-col gap-8 border-t p-6 sm:p-8 md:border-l md:border-t-0 lg:p-10">
              {bio}
              {sources && <div className="mt-auto border-t pt-6">{sources}</div>}
            </div>
          </div>
        ) : (
          <div className={cn("card grid overflow-hidden", sources && "lg:grid-cols-[minmax(0,1fr)_24rem]")}>
            <div className="p-6 sm:p-8 lg:p-10">{bio}</div>
            {sources && <div className="border-t p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">{sources}</div>}
          </div>
        )}

        {person.documents.length > 0 && (
          <section aria-labelledby="person-documents">
            <h2 id="person-documents" className="text-2xl sm:text-3xl">{t("person.documents")}</h2>
            <div className="mt-6">
              {person.documents.length < 3 ? <DocumentRows items={person.documents} /> : <DocumentTiles items={person.documents} closing={<LinkTile accent href="/catalog" title={t("collections.toCatalog")} text={t("collections.toCatalogText")} />} />}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section aria-labelledby="person-others">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <h2 id="person-others" className="text-2xl sm:text-3xl">{t("person.others")}</h2>
              <Link href="/memory#persons" className="text-link font-semibold">{t("person.all")}</Link>
            </div>
            <ul className="mt-6 grid auto-rows-fr gap-4 lg:grid-cols-2">
              {others.slice(0, others.length - (others.length % 2 && others.length > 1 ? 1 : 0)).map((item, index) => (
                <li key={item.slug} className="min-w-0"><PersonCard person={item} portrait={otherPortraits[index]} /></li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
