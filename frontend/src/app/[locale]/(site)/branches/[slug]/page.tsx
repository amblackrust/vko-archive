import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { ApiError, api, type Schema } from "@/lib/api/client";
import { Breadcrumbs } from "@/components/ui/page-head";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { PointMap } from "@/components/branches/point-map";

export default async function BranchPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [t, nav, lang] = await Promise.all([getTranslations("branches"), getTranslations("nav.primary"), getLocale()]);
  const b = await api.get<Schema["BranchItem"]>(`/api/branches/${slug}`, { query: { lang }, revalidate: 0 }).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const has = b.lat != null && b.lng != null;
  const routes = has
    ? [
        { id: "2gis", url: `https://2gis.kz/?m=${b.lng},${b.lat}/16` },
        { id: "google", url: `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}` },
        { id: "yandex", url: `https://yandex.kz/maps/?rtext=~${b.lat},${b.lng}&rtt=auto` },
      ]
    : [];
  return (
    <>
      <section className="relative h-[52dvh] min-h-[22rem] overflow-hidden">
        {has && <PointMap slug={b.slug} name={b.name} lat={b.lat as number} lng={b.lng as number} head={b.type === "head"} />}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] p-3 md:p-6">
          <div className="glass pointer-events-auto max-w-[56rem] rounded-[28px] border border-line p-6 shadow-lift-high md:p-8">
            <Breadcrumbs items={[{ label: nav("branches"), href: "/branches" }, { label: b.name }]} />
            <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone="action">{t.has(`type.${b.type}`) ? t(`type.${b.type}`) : b.type}</Badge>{!b.coords_verified && <Badge tone="warn">{t("approx")}</Badge>}</div>
            <h1 className="text-[clamp(2rem,4.5vw,3.5rem)] tracking-[-0.035em]">{b.name}</h1>
          </div>
        </div>
      </section>
      <div className="wrap mt-12 grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <dl className="space-y-6">
          {[[t("address"), b.address], [t("director"), b.director], [t("hours"), b.hours]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt className="edge">{k}</dt><dd className="mt-1 font-display text-2xl font-medium tracking-[-0.02em]">{v}</dd></div>
          ))}
          {b.description && <p className="max-w-[60ch] text-lg text-ink-2">{b.description}</p>}
          {b.funds_summary && <div><dt className="edge">{t("funds")}</dt><dd className="mt-1 max-w-[60ch] text-ink-2">{b.funds_summary}</dd></div>}
        </dl>
        <div>
          <ul className="space-y-3">
            {b.phone && <li><a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="tnum flex items-center gap-3 font-display text-3xl font-medium tracking-[-0.03em] no-underline hover:text-action"><Phone size={22} aria-hidden /> {b.phone}</a></li>}
            {b.email && <li><a href={`mailto:${b.email}`} className="flex items-center gap-3 text-lg no-underline hover:text-action"><Mail size={20} aria-hidden /> {b.email}</a></li>}
          </ul>
          {routes.length > 0 && (
            <div className="mt-8">
              <p className="mb-3 text-sm text-ink-3">{t("route")}</p>
              <div className="flex flex-wrap gap-2">{routes.map((r) => <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>{t(`providers.${r.id}`)} <ArrowUpRight size={15} aria-hidden /></a>)}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
