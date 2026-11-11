import { getTranslations, setRequestLocale } from "next-intl/server";
import { AboutNav } from "@/components/about/about-nav";
import { socialEntries } from "@/components/layout/social-data";
import { MapLinks } from "@/components/map/map-links";
import { safe } from "@/components/misc/api";
import { MailLink, PhoneLink, telHref } from "@/components/misc/contact-links";
import { JsonLd } from "@/components/misc/json-ld";
import { pageMetadata } from "@/components/misc/metadata";
import { Block, PageBody, SeeAlso } from "@/components/misc/page-layout";
import { ExternalServiceLinks } from "@/components/services/external-links";
import { ExternalLink } from "@/components/ui/external-link";
import { FactList } from "@/components/ui/facts";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { fetchContacts, type Contacts } from "@/lib/api/content";
import { fetchSiteSettings } from "@/lib/api/site-settings";
import { Link } from "@/lib/i18n/navigation";
import { localeUrl } from "@/lib/seo";

export const generateMetadata = pageMetadata("contacts", "/contacts");

/** Разметка schema.org: поисковики показывают адрес и телефоны архива в своей выдаче. */
const organizationLd = (contacts: Contacts, name: string, url: string) => ({
  "@context": "https://schema.org",
  "@type": "ArchiveOrganization",
  name,
  url,
  address: contacts.address,
  email: contacts.email,
  contactPoint: contacts.phones.map((phone) => ({ "@type": "ContactPoint", contactType: phone.label, telephone: telHref(phone.value).slice(4) })),
});

/** Контакты головного архива: телефоны по назначению, адрес, почта, режим работы, соцсети. */
export default async function ContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contacts");
  const layout = await getTranslations("layout");
  const [contacts, settings] = await Promise.all([safe(fetchContacts()), fetchSiteSettings(locale)]);
  const social = socialEntries(settings?.social);

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <AboutNav active="contacts" />
      <PageBody
        aside={
          <>
            {contacts && (
              <FactList
                items={[
                  { label: t("hours"), value: <span lang="ru">{contacts.hours}</span> },
                  { label: t("readingRoomHours"), value: <span lang="ru">{contacts.reading_room_hours}</span> },
                  { label: t("director"), value: <span lang="ru">{contacts.director}</span> },
                ]}
              />
            )}
            <SeeAlso
              title={t("more.title")}
              items={[
                { href: "/branches", label: t("more.branches"), text: t("more.branchesText") },
                { href: "/about/structure", label: t("more.structure"), text: t("more.structureText") },
                { href: "/help/reading-room", label: t("more.readingRoom") },
                { href: "/help/faq", label: t("more.faq") },
              ]}
            />
          </>
        }
      >
        {contacts ? (
          <>
            <JsonLd data={organizationLd(contacts, layout("siteName"), localeUrl(locale, ""))} />
            <Block id="phones" title={t("phones")}>
              <dl className="card divide-y px-5" lang="ru">
                {contacts.phones.map((phone) => (
                  <div key={phone.label} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(0,16rem)_1fr]">
                    <dt className="text-muted-foreground">{phone.label}</dt>
                    <dd className="font-semibold"><PhoneLink value={phone.value} /></dd>
                  </div>
                ))}
              </dl>
            </Block>
            <Block id="address" title={t("address")}>
              <address className="max-w-3xl text-lg not-italic" lang="ru">{contacts.address}</address>
              <p><MailLink value={contacts.email} className="font-semibold" /></p>
              <p className="text-sm text-muted-foreground">{t("mapsText")}</p>
              <MapLinks destination={contacts.address} />
              <p><Link href="/branches" className="text-link font-medium">{t("onMap")}</Link></p>
            </Block>
          </>
        ) : (
          <Notice tone="warning" title={t("unavailableTitle")}>{t("unavailable")}</Notice>
        )}

        {social.length > 0 && (
          <Block id="social" title={t("social")}>
            <ul className="card divide-y px-5">
              {social.map(([network, link]) => (
                <li key={network} className="py-3">
                  <ExternalLink href={link.url} className="font-medium">
                    {layout.has(`social.${network}`) ? layout(`social.${network}`) : (link.handle ?? network)}
                  </ExternalLink>
                </li>
              ))}
            </ul>
          </Block>
        )}

        <Block id="appeals" title={t("appeals.title")} text={t("appeals.text")}>
          <ExternalServiceLinks />
          <p><Link href="/services" className="text-link font-medium">{t("appeals.link")}</Link></p>
        </Block>
      </PageBody>
    </>
  );
}
