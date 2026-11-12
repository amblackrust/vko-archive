import { getLocale, getTranslations } from "next-intl/server";
import { Camera, Share2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { api, type Schema } from "@/lib/api/client";
import { GROUPS } from "@/lib/nav";

export async function Footer() {
  const [t, nav, locale] = await Promise.all([getTranslations("footer"), getTranslations("nav"), getLocale()]);
  const [contacts, settings] = await Promise.all([
    api.get<Schema["Contacts"]>("/api/contacts", { query: { lang: locale } }).catch(() => null),
    api.get<Schema["PublicSettings"]>("/api/site-settings").catch(() => null),
  ]);
  const social = settings?.social;

  return (
    <footer className="mt-28 border-t border-frame bg-mount">
      <div className="wrap grid gap-x-10 gap-y-12 py-14 md:grid-cols-2 xl:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div>
          <p className="font-display text-2xl leading-snug">{contacts?.address}</p>
          <ul className="mt-5 space-y-0.5 text-ink-2">
            {contacts?.phones?.[0] && <li><a href={`tel:${contacts.phones[0].value.replace(/[^\d+]/g, "")}`} className="tnum no-underline hover:text-action">{contacts.phones[0].value}</a></li>}
            {contacts?.email && <li><a href={`mailto:${contacts.email}`} className="no-underline hover:text-action">{contacts.email}</a></li>}
          </ul>
          {contacts?.hours && <p className="mt-4 text-ink-2">{contacts.hours}</p>}
        </div>
        {GROUPS.map((group) => (
          <nav key={group.key} aria-label={nav(`groups.${group.key}`)}>
            <h2 className="mb-3 font-sans text-sm font-normal tracking-normal text-ink-3">{nav(`groups.${group.key}`)}</h2>
            <ul className="space-y-1.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="no-underline hover:text-action hover:underline">
                    {nav(`items.${item.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="wrap flex flex-col gap-3 border-t border-frame py-5 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-6">{t("rights", { year: new Date().getFullYear() })}</p>
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:justify-end">
          {social?.instagram?.url && (
            <li>
              <a href={social.instagram.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-6 items-center gap-1.5 no-underline hover:text-action">
                <Camera size={16} aria-hidden /> Instagram
              </a>
            </li>
          )}
          {social?.facebook?.url && (
            <li>
              <a href={social.facebook.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-6 items-center gap-1.5 no-underline hover:text-action">
                <Share2 size={16} aria-hidden /> Facebook
              </a>
            </li>
          )}
          <li className="inline-flex h-6 items-center">
            <Link href="/privacy" className="no-underline hover:text-action">{t("privacy")}</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
