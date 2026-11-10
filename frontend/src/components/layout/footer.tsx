import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { SocialLinks } from "./social-links";

const govLinks = [
  { id: "egov", href: "https://egov.kz" },
  { id: "eotinish", href: "https://eotinish.kz" },
  { id: "govkz", href: "https://www.gov.kz" },
] as const;

export function Footer() {
  const t = useTranslations("layout");
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t bg-surface-muted">
      <div className="container-page grid gap-8 py-10 md:grid-cols-2 lg:grid-cols-4">
        <section>
          <h2 className="font-serif text-base font-semibold">{t("siteName")}</h2>
          <address className="mt-3 text-sm not-italic text-muted-foreground">{t("contactsBlock.addressValue")}</address>
          <SocialLinks className="mt-3 -ml-2" />
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold">{t("contactsBlock.title")}</h2>
          <dl className="mt-3 space-y-1 text-sm">
            <div><dt className="inline text-muted-foreground">{t("contactsBlock.phone")}: </dt><dd className="inline"><a href="tel:+77232251322" className="hover:underline">{t("contactsBlock.phoneValue")}</a></dd></div>
            <div><dt className="inline text-muted-foreground">{t("contactsBlock.reception")}: </dt><dd className="inline"><a href="tel:+77232255976" className="hover:underline">{t("contactsBlock.receptionValue")}</a></dd></div>
            <div><dt className="inline text-muted-foreground">{t("contactsBlock.email")}: </dt><dd className="inline"><a href={`mailto:${t("contactsBlock.emailValue")}`} className="hover:underline">{t("contactsBlock.emailValue")}</a></dd></div>
          </dl>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold">{t("hours.title")}</h2>
          <ul className="mt-3 space-y-1 text-sm">
            <li>{t("hours.office")}</li>
            <li>{t("hours.readingRoom")}</li>
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold">{t("govResources.title")}</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {govLinks.map((link) => (
              <li key={link.id}>
                <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  {t(`govResources.${link.id}`)}
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  <span className="sr-only">({t("govResources.external")})</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col gap-2 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t("copyright", { year, name: t("siteName") })}</p>
          <p className="font-medium text-accent">{t("prototype")}</p>
          <Link href="/privacy" className="hover:underline">{t("privacy")}</Link>
        </div>
      </div>
    </footer>
  );
}
