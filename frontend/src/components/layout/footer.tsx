import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { CalendarWidget } from "@/components/misc/calendar-widget";
import { Link } from "@/lib/i18n/navigation";
import { LogoMark } from "./logo";
import { footerLinks } from "./nav-config";
import { useSiteSettings } from "./site-settings";
import { SocialLinks } from "./social-links";

const govLinks = [
  { id: "egov", href: "https://egov.kz" },
  { id: "eotinish", href: "https://eotinish.kz" },
  { id: "govkz", href: "https://www.gov.kz" },
] as const;

export function Footer() {
  const t = useTranslations("layout");
  const year = new Date().getFullYear();
  const settings = useSiteSettings();
  const usefulLinks = settings?.useful_links ?? [];
  const external =
    usefulLinks.length > 0
      ? usefulLinks.map((link) => ({ id: link.url, href: link.url, label: link.title }))
      : govLinks.map((link) => ({ id: link.id, href: link.href, label: t(`govResources.${link.id}`) }));
  const heading = "text-sm font-semibold text-muted-foreground";
  return (
    <footer className="on-brand mt-auto" data-noprint>
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <section>
          <div className="flex items-start gap-3">
            <LogoMark className="mt-1 size-9 shrink-0" />
            <p className="max-w-xs text-lg font-bold leading-snug">{t("siteName")}</p>
          </div>
          <address className="mt-4 max-w-xs text-sm not-italic text-muted-foreground">{t("contactsBlock.addressValue")}</address>
          <SocialLinks className="-ml-2 mt-3" />
        </section>
        <section>
          <h2 className={heading}>{t("contactsBlock.title")}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-muted-foreground">{t("contactsBlock.phone")}</dt><dd><a href="tel:+77232251322" className="font-medium hover:underline">{t("contactsBlock.phoneValue")}</a></dd></div>
            <div><dt className="text-muted-foreground">{t("contactsBlock.reception")}</dt><dd><a href="tel:+77232255976" className="font-medium hover:underline">{t("contactsBlock.receptionValue")}</a></dd></div>
            <div><dt className="text-muted-foreground">{t("contactsBlock.email")}</dt><dd><a href={`mailto:${t("contactsBlock.emailValue")}`} className="font-medium hover:underline">{t("contactsBlock.emailValue")}</a></dd></div>
          </dl>
          <h2 className={`${heading} mt-6`}>{t("hours.title")}</h2>
          <ul className="mt-3 space-y-1 text-sm">
            <li>{t("hours.office")}</li>
            <li>{t("hours.readingRoom")}</li>
          </ul>
        </section>
        <nav aria-label={t("footerNav")}>
          <h2 className={heading}>{t("footerNav")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {footerLinks.map((item) => (
              <li key={item.id}><Link href={item.href} className="hover:underline">{t(`nav.items.${item.id}`)}</Link></li>
            ))}
          </ul>
        </nav>
        <section>
          <h2 className={heading}>{t("govResources.title")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {external.map((link) => (
              <li key={link.id}>
                <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 hover:underline">
                  {link.label}
                  <ExternalLink className="mt-1 size-3.5 shrink-0" aria-hidden />
                  <span className="sr-only">({t("govResources.external")})</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {settings?.widgets.calendar_weather !== false && (
        <div className="container-page pb-10">
          <CalendarWidget />
        </div>
      )}
      <div className="border-t">
        <div className="container-page flex flex-col gap-2 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t("copyright", { year, name: t("siteName") })}</p>
          {settings?.counter.enabled && <p>{t("counter", { count: settings.counter.value })}</p>}
          <Link href="/privacy" className="hover:underline">{t("privacy")}</Link>
        </div>
      </div>
    </footer>
  );
}
