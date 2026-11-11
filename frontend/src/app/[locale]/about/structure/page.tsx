import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AboutNav } from "@/components/about/about-nav";
import { parseStructure, type Person } from "@/components/about/structure";
import { TranslationNote } from "@/components/help/translation-note";
import { safe } from "@/components/misc/api";
import { MailLink, PhoneLink } from "@/components/misc/contact-links";
import { RichText } from "@/components/misc/rich-text";
import { Unavailable } from "@/components/misc/state-help";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { fetchPage, pageSeo } from "@/lib/api/content";
import { localizedAlternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about.structure" });
  const page = await safe(fetchPage("structure", locale));
  return { title: t("title"), description: t("lead"), ...(page?.lang === locale ? pageSeo(page) : {}), alternates: localizedAlternates(locale, "/about/structure") };
}

const heading = "text-2xl sm:text-3xl";

/** Телефон и почта сотрудника ссылками; прижаты к низу карточки, поэтому в ряду стоят на одной линии. */
function PersonContacts({ person }: { person: Person }) {
  if (!person.phone && !person.email) return null;
  return (
    <p className="mt-3 flex flex-col items-start gap-1.5 text-[0.9375rem]">
      {person.phone && <PhoneLink value={person.phone} className="font-medium" />}
      {person.email && <MailLink value={person.email} />}
    </p>
  );
}

/**
 * Руководство и отделы: три равные карточки руководителей и ровная сетка отделов (руководитель, телефон, почта).
 * Данные — из страницы CMS «structure»; якоря #unit-N — на них ссылается обзор раздела.
 */
export default async function StructurePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const page = await fetchPage("structure", locale).catch(() => undefined);
  if (page === undefined) return <Unavailable />;
  if (!page) notFound();
  const [management, ...departments] = parseStructure(page.body);
  // Отдел с двумя сотрудниками занимает две ячейки; неполный последний ряд закрывают переходы в соседние разделы.
  const span = (people: Person[]) => Math.min(people.length, 2);
  const cells = departments.reduce((sum, unit) => sum + span(unit.people), 0);
  const fillers = (["contacts", "branches"] as const).slice(0, (3 - (cells % 3)) % 3);

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("title"), href: "/about" }, { label: t("structure.title") }]}
        title={page.lang === locale ? page.title : t("structure.title")}
        lead={t("structure.lead")}
      />
      <AboutNav active="structure" />
      <div className="container-page space-y-14 pb-16 pt-8">
        <TranslationNote requested={locale} actual={page.lang} status={page.translation_status} />
        {!management && <div className="card p-6 sm:p-10"><RichText html={page.body} lang={page.lang} /></div>}

        {management && (
          <section id={management.id} aria-labelledby={`${management.id}-title`} className="scroll-mt-28" lang={page.lang}>
            <h2 id={`${management.id}-title`} className={heading}>{management.name}</h2>
            <ul className="mt-6 grid auto-rows-fr gap-4 md:grid-cols-3">
              {management.people.map((person) => (
                <li key={`${person.role}-${person.name}`} className="card flex h-full flex-col p-6">
                  <p className="text-sm text-muted-foreground">{person.role}</p>
                  <p className="mt-1 text-lg font-bold leading-snug">{person.name}</p>
                  <div className="mt-auto pt-2"><PersonContacts person={person} /></div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {departments.length > 0 && (
          <section aria-labelledby="units-title">
            <h2 id="units-title" className={heading}>{t("units.title")}</h2>
            <ul className="mt-6 grid grid-flow-dense auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3" lang={page.lang}>
              {departments.map((unit) => (
                <li
                  key={unit.id}
                  id={unit.id}
                  className={cn("card flex h-full scroll-mt-28 flex-col p-6 target:ring-2 target:ring-primary", span(unit.people) > 1 && "md:col-span-2")}
                >
                  <h3 className="text-[1.0625rem] leading-snug">{unit.name}</h3>
                  <ul className={cn("mt-auto grid gap-x-8 gap-y-5 pt-6", span(unit.people) > 1 && "sm:grid-cols-2")}>
                    {unit.people.map((person) => (
                      <li key={`${person.role}-${person.name}`} className="min-h-[7.25rem] min-w-0">
                        <p className="text-sm text-muted-foreground">{person.role}</p>
                        <p className="mt-0.5 font-semibold leading-snug">{person.name}</p>
                        <PersonContacts person={person} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
              {fillers.map((id, index) => (
                <li key={id} lang={locale} className="hidden xl:block">
                  <LinkTile href={id === "contacts" ? "/contacts" : "/branches"} title={t(`sections.${id}.label`)} text={t(`sections.${id}.text`)} accent={index === 0} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
