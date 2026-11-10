import { BookOpen, Camera, Library } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { localizedAlternates } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { StateView } from "@/components/ui/state-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "misc.publications" });
  return { title: t("title"), description: t("intro"), alternates: localizedAlternates(locale, "/publications") };
}

const sections = [
  { key: "publications", icon: BookOpen },
  { key: "collections", icon: Library },
  { key: "photos", icon: Camera },
] as const;

export default async function PublicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("misc.publications");
  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-8 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
        </header>
        <ul className="grid gap-3 sm:grid-cols-3">
          {sections.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-center gap-3 rounded-lg border bg-surface p-4">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="font-medium">{t(`sections.${key}`)}</span>
            </li>
          ))}
        </ul>
        <StateView icon={BookOpen} as="h2" title={t("pending")}>
          <Button asChild variant="outline">
            <Link href="/catalog">{t("catalogLink")}</Link>
          </Button>
        </StateView>
      </div>
    </>
  );
}
