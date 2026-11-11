import { getTranslations, setRequestLocale } from "next-intl/server";
import { AboutNav } from "@/components/about/about-nav";
import { ContactTile } from "@/components/about/contact-tile";
import { socialEntries } from "@/components/layout/social-data";
import { BranchMap } from "@/components/map/branch-map-loader";
import { MapLinks } from "@/components/map/map-links";
import { mapQuery } from "@/components/map/route-links";
import { safe } from "@/components/misc/api";
import { telHref } from "@/components/misc/contact-links";
import { JsonLd } from "@/components/misc/json-ld";
import { pageMetadata } from "@/components/misc/metadata";
import { ExternalServiceLinks } from "@/components/services/external-links";
import { SocialCard } from "@/components/ui/brand";
import { LinkTile } from "@/components/ui/link-tile";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { fetchBranches } from "@/lib/api/branches";
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

// Названия сетей — имена собственные, на всех языках одинаковы.
const NETWORKS: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", telegram: "Telegram", youtube: "YouTube", whatsapp: "WhatsApp" };

/** Имя страницы для карточки соцсети: из настроек сайта, а без него — последний отрезок адреса («vkoarhiv»). */
const pageName = (url: string, handle: string | null) => handle ?? (new URL(url).pathname.split("/").filter(Boolean).pop() || new URL(url).hostname);

const split = "grid gap-x-10 gap-y-6 lg:grid-cols-12";
const heading = "text-2xl sm:text-3xl";

/**
 * Контакты головного архива: телефоны и почта плитками, адрес с картой и режимом работы,
 * соцсети и государственные порталы карточками, переходы в соседние разделы.
 */
export default async function ContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contacts");
  const map = await getTranslations("map");
  const layout = await getTranslations("layout");
  const [contacts, settings, branches] = await Promise.all([safe(fetchContacts()), fetchSiteSettings(locale), safe(fetchBranches(locale))]);
  const social = socialEntries(settings?.social);
  const head = branches?.find((branch) => branch.type === "head" && branch.show_on_map && branch.lat != null && branch.lng != null);
  // Плиток — телефоны и почта; неполный ряд из трёх закрывают переходы на структуру и к филиалам.
  const tiles = contacts ? contacts.phones.length + 1 : 0;
  const fillers = [
    { href: "/about/structure", title: t("more.structure"), text: t("more.structureText") },
    { href: "/branches", title: t("more.branches"), text: t("more.branchesText") },
  ].slice(0, (3 - (tiles % 3)) % 3);

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <AboutNav active="contacts" />
      <div className="container-page space-y-14 pb-16 pt-8">
        {contacts ? (
          <>
            <JsonLd data={organizationLd(contacts, layout("siteName"), localeUrl(locale, ""))} />
            <section id="phones" aria-labelledby="phones-title" className={`${split} scroll-mt-28`}>
              <div className="lg:col-span-4">
                <h2 id="phones-title" className={heading}>{t("phones")}</h2>
                <p className="mt-3 text-muted-foreground">{t("phonesText")}</p>
                <p className="mt-3"><Link href="/about/structure" className="text-link font-semibold">{t("structureLink")}</Link></p>
              </div>
              <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:col-span-8 xl:grid-cols-3">
                {contacts.phones.map((phone) => (
                  <li key={phone.label} lang="ru"><ContactTile kind="phone" label={phone.label} value={phone.value} /></li>
                ))}
                <li><ContactTile kind="mail" label={t("email")} value={contacts.email} /></li>
                {fillers.map((tile, index) => (
                  <li key={tile.href} className="hidden xl:block"><LinkTile {...tile} accent={index === 0} /></li>
                ))}
              </ul>
            </section>

            <section id="address" aria-labelledby="address-title" className="card grid scroll-mt-28 overflow-hidden rounded-3xl lg:grid-cols-2">
              <div className="flex flex-col gap-6 p-6 sm:p-10">
                <h2 id="address-title" className={heading}>{t("addressTitle")}</h2>
                <address className="text-xl font-semibold not-italic leading-snug" lang="ru">{contacts.address}</address>
                <dl className="divide-y border-y" lang="ru">
                  {[
                    { label: t("hours"), value: contacts.hours },
                    { label: t("readingRoomHours"), value: contacts.reading_room_hours },
                    { label: t("director"), value: contacts.director },
                  ].filter((row) => row.value).map((row) => (
                    <div key={row.label} className="grid gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                      <dt className="text-muted-foreground" lang={locale}>{row.label}</dt>
                      <dd className="font-semibold">{row.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-auto space-y-3">
                  <h3 className="text-base">{t("routeTitle")}</h3>
                  <MapLinks destination={mapQuery(contacts.address)} />
                </div>
                <p><Link href="/branches" className="text-link font-semibold">{t("onMap")}</Link></p>
              </div>
              {head && (
                <div className="h-80 lg:h-auto lg:min-h-[30rem]">
                  <BranchMap branches={[head]} selected={head.slug} label={map("map.label")} tileErrorText={map("map.tilesFailed")} />
                </div>
              )}
            </section>
          </>
        ) : (
          <Notice tone="warning" title={t("unavailableTitle")}>{t("unavailable")}</Notice>
        )}

        {social.length > 0 && (
          <section id="social" aria-labelledby="social-title" className={`${split} scroll-mt-28`}>
            <h2 id="social-title" className={`${heading} lg:col-span-4`}>{t("social")}</h2>
            <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:col-span-8">
              {social.map(([network, link]) => (
                <li key={network}>
                  <SocialCard network={network} name={NETWORKS[network] ?? network} handle={pageName(link.url, link.handle)} href={link.url} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="appeals" aria-labelledby="appeals-title" className={`${split} scroll-mt-28`}>
          <div className="lg:col-span-4">
            <h2 id="appeals-title" className={heading}>{t("appeals.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("appeals.text")}</p>
            <p className="mt-3"><Link href="/services" className="text-link font-semibold">{t("appeals.link")}</Link></p>
          </div>
          <div className="lg:col-span-8"><ExternalServiceLinks /></div>
        </section>

        <nav aria-labelledby="more-title">
          <h2 id="more-title" className={heading}>{t("more.title")}</h2>
          <ul className="mt-6 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <li><LinkTile href="/branches" title={t("more.branches")} text={t("more.branchesText")} /></li>
            <li><LinkTile href="/about/structure" title={t("more.structure")} text={t("more.structureText")} /></li>
            <li><LinkTile href="/help/reading-room" title={t("more.readingRoom")} text={t("more.readingRoomText")} /></li>
            <li><LinkTile href="/help/faq" title={t("more.faq")} text={t("more.faqText")} /></li>
          </ul>
        </nav>
      </div>
    </>
  );
}
