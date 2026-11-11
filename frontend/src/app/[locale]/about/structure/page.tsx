import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AboutNav } from "@/components/about/about-nav";
import { parseStructure } from "@/components/about/structure";
import { TranslationNote } from "@/components/help/translation-note";
import { safe } from "@/components/misc/api";
import { MailLink, PhoneLink } from "@/components/misc/contact-links";
import { PageBody, PageToc, SeeAlso } from "@/components/misc/page-layout";
import { RichText } from "@/components/misc/rich-text";
import { Unavailable } from "@/components/misc/state-help";
import { PageHeader } from "@/components/ui/page-header";
import { fetchPage, pageSeo } from "@/lib/api/content";
import { localizedAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about.structure" });
  const page = await safe(fetchPage("structure", locale));
  return { title: t("title"), description: t("lead"), ...(page?.lang === locale ? pageSeo(page) : {}), alternates: localizedAlternates(locale, "/about/structure") };
}

/** Руководство и отделы: должность, имя, телефон и e-mail ссылками; данные — из страницы CMS «structure». */
export default async function StructurePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const page = await fetchPage("structure", locale).catch(() => undefined);
  if (page === undefined) return <Unavailable />;
  if (!page) notFound();
  const units = parseStructure(page.body);

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("title"), href: "/about" }, { label: t("structure.title") }]}
        title={page.lang === locale ? page.title : t("structure.title")}
        lead={t("structure.lead")}
      />
      <AboutNav active="structure" />
      <PageBody
        aside={
          <>
            {units.length > 1 && (
              <div className="hidden lg:block" lang={page.lang}>
                <PageToc title={t("structure.toc")} items={units.map((unit) => ({ id: unit.id, label: unit.name }))} />
              </div>
            )}
            <SeeAlso
              title={t("structure.more")}
              items={[
                { href: "/contacts", label: t("sections.contacts.label"), text: t("sections.contacts.text") },
                { href: "/branches", label: t("sections.branches.label"), text: t("sections.branches.text") },
              ]}
            />
          </>
        }
      >
        <TranslationNote requested={locale} actual={page.lang} status={page.translation_status} />
        {units.length === 0 && <RichText html={page.body} lang={page.lang} />}
        {units.map((unit) => (
          <section key={unit.id} id={unit.id} aria-labelledby={`${unit.id}-title`} className="scroll-mt-28" lang={page.lang}>
            <h2 id={`${unit.id}-title`} className="text-xl sm:text-2xl">{unit.name}</h2>
            <ul className="card mt-4 divide-y px-5 sm:px-6">
              {unit.people.map((person) => (
                <li key={`${person.role}-${person.name}`} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[15rem_minmax(0,1fr)]">
                  <p className="text-sm text-muted-foreground sm:pt-0.5">{person.role}</p>
                  <div className="min-w-0">
                    <p className="font-semibold">{person.name}</p>
                    {person.phone || person.email ? (
                      <p className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1.5 text-[0.9375rem]">
                        {person.phone && <PhoneLink value={person.phone} />}
                        {person.email && <MailLink value={person.email} />}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground" lang={locale}>{t("structure.noContacts")}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="max-w-3xl text-sm text-muted-foreground">{t("structure.source")}</p>
      </PageBody>
    </>
  );
}
