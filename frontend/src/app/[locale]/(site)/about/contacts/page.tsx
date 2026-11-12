import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Mail } from "lucide-react";
import { api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { PageHead } from "@/components/ui/page-head";
import { buttonClass } from "@/components/ui/button";

export default async function ContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nav, lang] = await Promise.all([getTranslations("info.contacts"), getTranslations("nav.items"), getLocale()]);
  const c = await api.get<Schema["Contacts"]>("/api/contacts", { query: { lang } }).catch(() => null);
  return (
    <>
      <PageHead title={t("title")} lead={c?.address} crumbs={[{ label: nav("about"), href: "/about" }, { label: t("title") }]} />
      <div className="wrap">
        {/* A directory: who, and the number in large type. */}
        <ul>
          {c?.phones.map((p) => (
            <li key={p.value} className="border-b border-line first:border-t">
              <a href={`tel:${p.value.replace(/[^\d+]/g, "")}`} className="group -mx-4 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 rounded-2xl px-4 py-6 no-underline transition-colors hover:bg-table-2">
                <span className="text-lg text-ink-2">{p.label}</span>
                <span className="tnum font-display text-4xl font-medium tracking-[-0.035em] transition-colors group-hover:text-action md:text-6xl">{p.value}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-14 grid gap-x-16 gap-y-8 md:grid-cols-3">
          {c?.director && <div><p className="edge">{t("director")}</p><p className="mt-1 font-display text-2xl font-medium tracking-[-0.02em]">{c.director}</p></div>}
          {c?.hours && <div><p className="edge">{t("hours")}</p><p className="mt-1 font-display text-2xl font-medium tracking-[-0.02em]">{c.hours}</p></div>}
          {c?.reading_room_hours && <div><p className="edge">{t("readingRoom")}</p><p className="mt-1 font-display text-2xl font-medium tracking-[-0.02em]">{c.reading_room_hours}</p></div>}
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          {c?.email && <a href={`mailto:${c.email}`} className={buttonClass("primary", "", "lg")}><Mail size={18} aria-hidden /> {c.email}</a>}
          <Link href="/branches" className={buttonClass("outline", "", "lg")}>{t("branches")}</Link>
        </div>
      </div>
    </>
  );
}
