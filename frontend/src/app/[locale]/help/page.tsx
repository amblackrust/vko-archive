import { Clock, Lock, LockKeyhole, LockOpen, type LucideIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HelpNav } from "@/components/help/help-nav";
import { Hierarchy } from "@/components/help/hierarchy";
import { pageMetadata } from "@/components/misc/metadata";
import { Block, PageBody, PageToc, SeeAlso, Steps } from "@/components/misc/page-layout";
import { DemoTag } from "@/components/ui/demo-tag";
import { LinkList } from "@/components/ui/link-list";
import { Notice } from "@/components/ui/notice";
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
// Шифр демонстрационной записи каталога; части шифра не переводятся.
const CIPHER = [
  { id: "fund", code: "Ф.Д-1" },
  { id: "inventory", code: "Оп.1" },
  { id: "case", code: "Д.1" },
  { id: "document", code: "№1" },
] as const;
const FIELDS = ["code", "place", "date", "type", "sheets", "storage", "access"] as const;
const ACCESS: { id: string; icon: LucideIcon }[] = [
  { id: "open", icon: LockOpen },
  { id: "restricted", icon: LockKeyhole },
  { id: "closed", icon: Lock },
  { id: "needs_review", icon: Clock },
];

export const generateMetadata = pageMetadata("help", "/help");

/** Справка по сайту: разделы, устройство каталога, поиск, виды материалов, шифр и статусы доступа. */
export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help");
  const rows = "card divide-y px-5";
  const row = "grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[13rem_minmax(0,1fr)]";

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <HelpNav active="guide" />
      <PageBody
        aside={
          <>
            <div className="hidden lg:block">
              <PageToc title={t("toc")} items={TOC.map((id) => ({ id, label: t(`${id}.title`) }))} />
            </div>
            <SeeAlso
              title={t("next.title")}
              items={[
                { href: "/help/faq", label: t("next.faq"), text: t("next.faqText") },
                { href: "/help/reading-room", label: t("next.readingRoom") },
                { href: "/assistant", label: t("next.assistant"), text: t("next.assistantText") },
                { href: "/contacts", label: t("next.contacts") },
              ]}
            />
          </>
        }
      >
        <div className="lg:hidden">
          <PageToc title={t("toc")} items={TOC.map((id) => ({ id, label: t(`${id}.title`) }))} />
        </div>

        <Block id="site" title={t("site.title")} text={t("site.text")}>
          <LinkList items={SITE.map(({ id, href }) => ({ href, label: t(`site.items.${id}.label`), text: t(`site.items.${id}.text`) }))} />
        </Block>

        <Block id="structure" title={t("structure.title")} text={t("structure.text")}>
          <Hierarchy label={t("structure.title")} />
          <p className="max-w-3xl text-sm text-muted-foreground">{t("structure.note")}</p>
        </Block>

        <Block id="search" title={t("search.title")} text={t("search.text")}>
          <Steps items={STEPS.map((id) => ({ title: t(`search.steps.${id}.title`), text: t(`search.steps.${id}.text`) }))} />
          <h3 className="pt-4 text-lg">{t("search.filtersTitle")}</h3>
          <dl className={rows}>
            {FILTERS.map((id) => (
              <div key={id} className={row}>
                <dt className="font-medium">{t(`search.filters.${id}.label`)}</dt>
                <dd className="text-muted-foreground">{t(`search.filters.${id}.text`)}</dd>
              </div>
            ))}
          </dl>
          <p className="flex flex-wrap gap-x-8 gap-y-2">
            <Link href="/search" className="text-link font-medium">{t("search.toSearch")}</Link>
            <Link href="/catalog" className="text-link font-medium">{t("search.toCatalog")}</Link>
          </p>
        </Block>

        <Block id="materials" title={t("materials.title")} text={t("materials.text")}>
          <LinkList items={MATERIALS.map(({ id, href }) => ({ href, label: t(`materials.items.${id}.label`), text: t(`materials.items.${id}.text`) }))} />
          <p className="flex max-w-3xl flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <DemoTag />
            {t("materials.demoNote")}
          </p>
        </Block>

        <Block id="cipher" title={t("cipher.title")} text={t("cipher.text")}>
          <ol aria-label={t("cipher.exampleLabel")} className="grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
            {CIPHER.map(({ id, code }) => (
              <li key={id} className="bg-surface p-4">
                <p className="cipher text-xl font-bold text-primary" lang="ru">{code}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t(`cipher.parts.${id}`)}</p>
              </li>
            ))}
          </ol>
          <p className="max-w-3xl text-sm text-muted-foreground">{t("cipher.note")}</p>
          <h3 className="pt-4 text-lg">{t("cipher.fieldsTitle")}</h3>
          <dl className={rows}>
            {FIELDS.map((id) => (
              <div key={id} className={row}>
                <dt className="font-medium">{t(`cipher.fields.${id}.label`)}</dt>
                <dd className="text-muted-foreground">{t(`cipher.fields.${id}.text`)}</dd>
              </div>
            ))}
          </dl>
        </Block>

        <Block id="access" title={t("access.title")} text={t("access.text")}>
          <dl className={rows}>
            {ACCESS.map(({ id, icon: Icon }) => (
              <div key={id} className={row}>
                <dt className="flex items-start gap-2 font-medium"><Icon className="mt-1 size-4 shrink-0" aria-hidden />{t(`access.items.${id}.label`)}</dt>
                <dd className="text-muted-foreground">{t(`access.items.${id}.text`)}</dd>
              </div>
            ))}
          </dl>
          <Notice>{t("access.notice")}</Notice>
        </Block>
      </PageBody>
    </>
  );
}
