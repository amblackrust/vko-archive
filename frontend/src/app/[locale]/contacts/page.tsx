import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SocialLinks } from "@/components/layout/social-links";
import { fetchContacts } from "@/lib/api/content";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

const links = [
  { key: "branches", href: "/branches" },
  { key: "faq", href: "/help/faq" },
  { key: "readingRoom", href: "/help/reading-room" },
  { key: "privacy", href: "/privacy" },
] as const;

/** `tel:` для номеров вида «8 (7232) 25-13-22»: берём последние 10 цифр и добавляем код +7. */
function telHref(value: string): string {
  return `tel:+7${value.replace(/\D/g, "").slice(-10)}`;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contacts" });
  return { title: t("title"), alternates: localizedAlternates(locale, "/contacts") };
}

export default async function ContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contacts");
  const contacts = await fetchContacts();
  return (
    <>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <div className="container-page space-y-8 pb-12">
        <header className="max-w-3xl space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("intro")}</p>
        </header>
        {!contacts ? (
          <p className="text-muted-foreground">{t("unavailable")}</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            <section className="space-y-4">
              <div>
                <h2 className="font-semibold">{t("address")}</h2>
                <address className="not-italic">{contacts.address}</address>
              </div>
              <div>
                <h2 className="font-semibold">{t("director")}</h2>
                <p>{contacts.director}</p>
              </div>
              <div>
                <h2 className="font-semibold">{t("email")}</h2>
                <a href={`mailto:${contacts.email}`} className="hover:underline">{contacts.email}</a>
              </div>
              <div>
                <h2 className="font-semibold">{t("phones")}</h2>
                <ul className="space-y-1">
                  {contacts.phones.map((phone) => (
                    <li key={phone.label}>
                      <span className="text-muted-foreground">{phone.label}: </span>
                      <a href={telHref(phone.value)} className="hover:underline">{phone.value}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            <section className="space-y-4">
              <div>
                <h2 className="font-semibold">{t("hours")}</h2>
                <p>{contacts.hours}</p>
              </div>
              <div>
                <h2 className="font-semibold">{t("readingRoomHours")}</h2>
                <p>{contacts.reading_room_hours}</p>
              </div>
              <div>
                <h2 className="font-semibold">{t("social")}</h2>
                <SocialLinks className="-ml-2 mt-1" />
              </div>
            </section>
          </div>
        )}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {links.map(({ key, href }) => (
            <li key={key}>
              <Link href={href} className="block rounded-lg border bg-surface p-4 font-medium hover:bg-surface-muted">
                {t(`links.${key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
