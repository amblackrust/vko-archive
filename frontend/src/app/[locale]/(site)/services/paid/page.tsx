import { getTranslations, setRequestLocale } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { api, type Schema } from "@/lib/api/client";
import { PageHead } from "@/components/ui/page-head";

export default async function PaidServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nav, lang] = await Promise.all([getTranslations("info.paid"), getTranslations("nav.groups"), getLocale()]);
  const c = await api.get<Schema["Contacts"]>("/api/contacts", { query: { lang } }).catch(() => null);
  return (
    <>
      <PageHead title={t("title")} lead={t("lead")} crumbs={[{ label: nav("services") }, { label: t("title") }]} />
      <div className="wrap grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <p className="max-w-[40ch] font-display text-[clamp(1.75rem,3.4vw,2.75rem)] font-medium leading-[1.2] tracking-[-0.03em]">{t("doc")}</p>
        <div className="self-end">
          <p className="text-lg text-ink-2">{t("price")}</p>
          {c?.phones?.[0] && <a href={`tel:${c.phones[0].value.replace(/[^\d+]/g, "")}`} className="tnum mt-4 inline-block font-display text-3xl font-medium tracking-[-0.03em] no-underline hover:text-action">{c.phones[0].value}</a>}
        </div>
      </div>
    </>
  );
}
