import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { api, type Schema } from "@/lib/api/client";
import { PageHead } from "@/components/ui/page-head";

export default async function ReadingRoomPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nav, lang] = await Promise.all([getTranslations("info.readingRoom"), getTranslations("nav.primary"), getLocale()]);
  const c = await api.get<Schema["Contacts"]>("/api/contacts", { query: { lang } }).catch(() => null);
  return (
    <>
      <PageHead title={t("title")} crumbs={[{ label: nav("help"), href: "/help" }, { label: t("title") }]} />
      <div className="wrap grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <div>
          <p className="edge">{t("hours")}</p>
          <p className="tnum mt-2 font-display text-[clamp(2.5rem,6vw,5rem)] font-semibold leading-[1.05] tracking-[-0.045em]">{c?.reading_room_hours}</p>
          <p className="mt-8 max-w-[56ch] text-xl leading-relaxed text-ink-2">{t("text")}</p>
        </div>
        <div className="space-y-6 self-end">
          {c?.address && <div><p className="edge">{t("address")}</p><p className="mt-1 font-display text-2xl font-medium tracking-[-0.02em]">{c.address}</p></div>}
          {c?.phones?.[2] && <p className="text-ink-2">{t("contact")} <a href={`tel:${c.phones[2].value.replace(/[^\d+]/g, "")}`} className="tnum text-action">{c.phones[2].value}</a></p>}
        </div>
      </div>
    </>
  );
}
