import { ChevronRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Link } from "@/lib/i18n/navigation";

const sections = [
  { key: "history", href: "/about/history" },
  { key: "structure", href: "/about/structure" },
  { key: "branches", href: "/branches" },
  { key: "legal", href: "/legal" },
  { key: "compliance", href: "/compliance" },
  { key: "contacts", href: "/contacts" },
] as const;

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-8 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
        </header>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(({ key, href }) => (
            <li key={key}>
              <Link href={href} className="flex items-center justify-between rounded-lg border bg-surface p-4 font-medium hover:bg-surface-muted">
                {t(`sections.${key}`)}
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("pending")}</p>
      </div>
    </>
  );
}
