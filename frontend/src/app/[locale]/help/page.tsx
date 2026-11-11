import { getTranslations, setRequestLocale } from "next-intl/server";
import { HelpNav } from "@/components/help/help-nav";
import { Hierarchy } from "@/components/help/hierarchy";
import { InfoTile, PageSection, PageStack, StepCards, TermList } from "@/components/misc/blocks";
import { pageMetadata } from "@/components/misc/metadata";
import { Button } from "@/components/ui/button";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { Link } from "@/lib/i18n/navigation";

// Якоря structure, search и materials открываются с главной страницы: не переименовывать.
const TOC = ["site", "structure", "search", "materials", "cipher", "access"] as const;
const SITE = [
  { id: "catalog", href: "/catalog" },
  { id: "services", href: "/services" },
  { id: "history", href: "/memory" },
  { id: "about", href: "/about" },
  { id: "branches", href: "/branches" },
] as const;
const STEPS = ["query", "filters", "open"] as const;
const FILTERS = ["fund", "period", "type", "topic", "branch", "language", "copy"] as const;
const MATERIALS = [
  { id: "funds", href: "/catalog/funds" },
  { id: "personal", href: "/catalog/funds?type=personal" },
  { id: "documents", href: "/catalog" },
  { id: "newspapers", href: "/catalog/newspapers" },
  { id: "exhibitions", href: "/exhibitions" },
  { id: "memory", href: "/memory" },
  { id: "calendar", href: "/calendar" },
] as const;
// Пример шифра по частям; части шифра не переводятся.
const CIPHER = [
  { id: "fund", code: "Ф.Д-1" },
  { id: "inventory", code: "Оп.1" },
  { id: "case", code: "Д.1" },
  { id: "document", code: "№1" },
] as const;
const FIELDS = ["code", "place", "date", "type", "sheets", "storage", "access"] as const;
// Цвета точек те же, что у статусов в каталоге.
const ACCESS = [
  { id: "open", dot: "bg-success" },
  { id: "restricted", dot: "bg-accent" },
  { id: "closed", dot: "bg-destructive" },
  { id: "needs_review", dot: "bg-border-strong" },
] as const;

export const generateMetadata = pageMetadata("help", "/help");

/** Справка по сайту: разделы, устройство каталога, поиск, виды материалов, шифр и статусы доступа. */
export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help");

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <HelpNav active="guide" />
      <PageStack className="pt-8">
        <nav aria-label={t("toc")} className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="text-muted-foreground">{t("toc")}</span>
          <ul className="contents">
            {TOC.map((id) => (
              <li key={id}><a href={`#${id}`} className="text-link inline-flex min-h-6 items-center font-medium">{t(`${id}.title`)}</a></li>
            ))}
          </ul>
        </nav>

        <PageSection id="site" title={t("site.title")} text={t("site.text")}>
          <ul className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
            {SITE.map(({ id, href }) => (
              <li key={id}><LinkTile href={href} title={t(`site.items.${id}.label`)} text={t(`site.items.${id}.text`)} /></li>
            ))}
            <li><LinkTile accent href="/assistant" title={t("next.assistant")} text={t("next.assistantText")} /></li>
          </ul>
        </PageSection>

        <PageSection id="structure" title={t("structure.title")} text={t("structure.text")}>
          <Hierarchy label={t("structure.title")} />
        </PageSection>

        <PageSection id="search" title={t("search.title")} text={t("search.text")}>
          <StepCards items={STEPS.map((id) => ({ title: t(`search.steps.${id}.title`), text: t(`search.steps.${id}.text`) }))} />
          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            <div className="card flex flex-col gap-4 p-6 lg:col-span-4">
              <h3 className="text-xl">{t("search.filtersTitle")}</h3>
              <p className="text-muted-foreground">{t("search.filtersText")}</p>
              <div className="mt-auto flex flex-col items-start gap-3 pt-2">
                <Button asChild><Link href="/catalog">{t("search.toCatalog")}</Link></Button>
                <Link href="/search" className="text-link font-medium">{t("search.toSearch")}</Link>
              </div>
            </div>
            <TermList className="lg:col-span-8" items={FILTERS.map((id) => ({ label: t(`search.filters.${id}.label`), text: t(`search.filters.${id}.text`) }))} />
          </div>
        </PageSection>

        <PageSection id="materials" title={t("materials.title")} text={t("materials.text")}>
          <ul className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-4">
            {MATERIALS.map(({ id, href }) => (
              <li key={id}><LinkTile href={href} title={t(`materials.items.${id}.label`)} text={t(`materials.items.${id}.text`)} /></li>
            ))}
            <li><LinkTile accent href="/search" title={t("materials.search")} text={t("materials.searchText")} /></li>
          </ul>
        </PageSection>

        <PageSection id="cipher" title={t("cipher.title")} text={t("cipher.text")}>
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-4">
              <ol aria-label={t("cipher.exampleLabel")} className="grid flex-1 grid-cols-2 gap-px overflow-hidden rounded-lg bg-border shadow-card">
                {CIPHER.map(({ id, code }) => (
                  <li key={id} className="flex flex-col justify-center gap-1 bg-surface p-5">
                    <p className="cipher text-xl font-bold text-primary" lang="ru">{code}</p>
                    <p className="text-sm text-muted-foreground">{t(`cipher.parts.${id}`)}</p>
                  </li>
                ))}
              </ol>
              <p className="text-[0.9375rem] text-muted-foreground">{t("cipher.note")}</p>
            </div>
            <section aria-labelledby="cipher-fields" className="lg:col-span-8">
              <h3 id="cipher-fields" className="sr-only">{t("cipher.fieldsTitle")}</h3>
              <TermList items={FIELDS.map((id) => ({ label: t(`cipher.fields.${id}.label`), text: t(`cipher.fields.${id}.text`) }))} />
            </section>
          </div>
        </PageSection>

        <PageSection id="access" title={t("access.title")} text={t("access.text")}>
          <ul className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-4">
            {ACCESS.map(({ id, dot }) => (
              <li key={id}>
                <InfoTile title={<span className="flex items-center gap-2.5"><span className={`size-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />{t(`access.items.${id}.label`)}</span>}>
                  {t(`access.items.${id}.text`)}
                </InfoTile>
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-3xl text-[0.9375rem] text-muted-foreground">{t("access.notice")}</p>
        </PageSection>

        <PageSection id="next" title={t("next.title")}>
          <ul className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
            <li><LinkTile href="/help/faq" title={t("next.faq")} text={t("next.faqText")} /></li>
            <li><LinkTile href="/help/reading-room" title={t("next.readingRoom")} text={t("next.readingRoomText")} /></li>
            <li><LinkTile href="/contacts" title={t("next.contacts")} text={t("faq.more.contactsText")} /></li>
          </ul>
        </PageSection>
      </PageStack>
    </>
  );
}
