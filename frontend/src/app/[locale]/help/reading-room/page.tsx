import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Link } from "@/lib/i18n/navigation";
import { fetchContacts } from "@/lib/api/content";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "help" });
  return { title: t("readingRoom.title"), alternates: localizedAlternates(locale, "/help/reading-room") };
}

export default async function ReadingRoomPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help");
  const contacts = await fetchContacts();
  const rules = t.raw("readingRoom.rules") as string[];
  return (
    <>
      <Breadcrumbs items={[{ label: t("title"), href: "/help" }, { label: t("readingRoom.title") }]} />
      <div className="container-page max-w-3xl space-y-8 pb-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{t("readingRoom.title")}</h1>
          <p className="text-muted-foreground">{t("readingRoom.intro")}</p>
        </header>

        <section className="rounded-lg border bg-surface p-4">
          <h2 className="font-semibold">{t("readingRoom.hoursLabel")}</h2>
          <p className="mt-1">{contacts?.reading_room_hours ?? t("readingRoom.hoursUnavailable")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("readingRoom.rulesTitle")}</h2>
          <p className="rounded-md border border-accent/40 bg-accent-soft p-3 text-sm text-accent-soft-foreground">
            {t("readingRoom.rulesNotice")}
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </section>

        <Button asChild variant="outline">
          <Link href="/catalog">{t("readingRoom.toCatalog")}</Link>
        </Button>
      </div>
    </>
  );
}
