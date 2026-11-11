import { Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartSearch } from "@/components/search/smart-search";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/search") };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("search");
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 500) ?? "";

  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-6 pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
          <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
        </header>
        <form role="search" action={`/${locale}/search`} method="get" className="flex max-w-3xl gap-2">
          <label htmlFor="smart-search-q" className="sr-only">{t("label")}</label>
          <Input
            id="smart-search-q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder={t("placeholder")}
            maxLength={500}
            autoComplete="off"
          />
          <Button type="submit">
            <Search aria-hidden />
            {t("submit")}
          </Button>
        </form>
        {query ? <SmartSearch key={query} query={query} /> : <p className="text-muted-foreground">{t("emptyQuery")}</p>}
      </div>
    </>
  );
}
