import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogStructure } from "@/components/help/catalog-structure";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

const navItems = [
  { key: "catalog", href: "/catalog" },
  { key: "branches", href: "/branches" },
  { key: "about", href: "/about" },
  { key: "faq", href: "/help/faq" },
  { key: "readingRoom", href: "/help/reading-room" },
  { key: "contacts", href: "/contacts" },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "help" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/help") };
}

export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help");
  const searchTips = t.raw("search.items") as string[];
  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-12 pb-12">
        <header className="max-w-3xl space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("intro")}</p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{t("nav.title")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {navItems.map(({ key, href }) => (
              <li key={key}>
                <Link href={href} className="block h-full rounded-lg border bg-surface p-4 hover:bg-surface-muted">
                  <span className="block font-medium">{t(`nav.items.${key}.label`)}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{t(`nav.items.${key}.text`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">{t("catalog.title")}</h2>
            <p className="text-muted-foreground">{t("catalog.intro")}</p>
            <CatalogStructure />
          </div>
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">{t("search.title")}</h2>
            <ol className="list-decimal space-y-2 pl-5">
              {searchTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ol>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <Link href="/help/faq" className="rounded-lg border bg-surface p-4 hover:bg-surface-muted">
            <span className="block font-semibold">{t("faqLink.title")}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{t("faqLink.text")}</span>
            <span className="mt-3 inline-block text-sm font-medium text-primary">{t("faqLink.action")}</span>
          </Link>
          <Link href="/contacts" className="rounded-lg border bg-surface p-4 hover:bg-surface-muted">
            <span className="block font-semibold">{t("contactsLink.title")}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{t("contactsLink.text")}</span>
            <span className="mt-3 inline-block text-sm font-medium text-primary">{t("contactsLink.action")}</span>
          </Link>
        </section>
      </div>
    </>
  );
}
