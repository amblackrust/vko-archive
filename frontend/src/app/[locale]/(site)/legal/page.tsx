import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Search } from "lucide-react";
import clsx from "clsx";
import { api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { PageHead } from "@/components/ui/page-head";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function LegalPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; status?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const [t, c, lang, format] = await Promise.all([getTranslations("info.legal"), getTranslations("common"), getLocale(), getFormatter()]);
  const res = await api.get<Schema["LegalActsResponse"]>("/api/legal-acts", { query: { lang, q: sp.q, status: sp.status }, revalidate: 0 }).catch(() => null);
  const items = res?.items ?? [];
  const tone = (s: string) => (s === "active" ? "ok" : s === "expired" ? "bad" : "neutral") as "ok" | "bad" | "neutral";
  const chip = (on: boolean) => clsx("inline-flex h-10 items-center rounded-full px-4 no-underline", on ? "bg-ink text-table" : "bg-table-3 text-ink-2 hover:text-ink");
  return (
    <>
      <PageHead title={t("title")} actions={
        <form action="" className="relative">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" defaultValue={sp.q} placeholder={t("search")} aria-label={t("search")} className="field !w-72 !rounded-full !pl-11" />
        </form>
      } />
      <div className="wrap">
        <nav className="mb-6 flex flex-wrap gap-2">
          <Link href="/legal" className={chip(!sp.status)}>{c("all")}</Link>
          {["active", "expired"].map((s) => <Link key={s} href={`/legal?status=${s}`} className={chip(sp.status === s)}>{t(`statuses.${s}`)}</Link>)}
        </nav>
        {items.length === 0 ? <EmptyState title={t("empty")} /> : (
          <ul>
            {items.map((a) => (
              <li key={a.id} className="grid gap-x-8 gap-y-1 border-b border-line py-6 first:border-t md:grid-cols-[minmax(0,1fr)_14rem_9rem]">
                <p className="font-display text-xl font-medium tracking-[-0.02em] md:text-2xl">{a.title}</p>
                <p className="text-sm text-ink-3">{[a.number && `${t("number")} ${a.number}`, a.date && format.dateTime(new Date(a.date), { day: "numeric", month: "long", year: "numeric" })].filter(Boolean).join(" · ")}<br />{a.issuer}</p>
                <div className="flex flex-wrap items-start gap-2 md:justify-end">
                  <Badge tone={tone(a.status)}>{t.has(`statuses.${a.status}`) ? t(`statuses.${a.status}`) : a.status}</Badge>
                  {a.adilet_url && <a href={a.adilet_url} target="_blank" rel="noopener noreferrer" className="text-sm text-action">{t("source")}</a>}
                  {a.file && <a href={a.file.url} target="_blank" rel="noopener noreferrer" className="text-sm text-action">{t("file")}</a>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
