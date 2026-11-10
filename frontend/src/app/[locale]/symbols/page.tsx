import { Flag } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { localizedAlternates } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { StateView } from "@/components/ui/state-view";
import { Link } from "@/lib/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "misc.symbols" });
  return { title: t("title"), description: t("intro"), alternates: localizedAlternates(locale, "/symbols") };
}

export default async function SymbolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("misc.symbols");
  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
        </header>
        <StateView icon={Flag} as="h2" title={t("pending")}>
          <Button asChild variant="outline">
            <Link href="/links">{t("linksLink")}</Link>
          </Button>
        </StateView>
      </div>
    </>
  );
}
