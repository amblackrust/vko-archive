"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { useAdmin } from "./admin-shell";

export function AdminDashboard() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const { me } = useAdmin();
  const { data } = useQuery({ queryKey: ["admin-dash"], queryFn: () => api.get<Schema["Dashboard"]>("/api/admin/dashboard", { scope: "admin" }) });
  const health = useQuery({ queryKey: ["health"], queryFn: () => api.get<Schema["HealthResponse"]>("/api/health"), staleTime: 30_000 });
  const c = data?.counters;
  const numbers: [string, number | null | undefined][] = [["funds", c?.funds], ["inventories", c?.inventories], ["cases", c?.cases], ["documents", c?.documents], ["published", c?.documents_published], ["users", c?.users]];
  return (
    <div>
      <h1 className="mb-2 text-4xl md:text-5xl">{me.full_name}</h1>
      <p className="mb-10 text-ink-3">{me.roles.map((r) => (t.has(`roleNames.${r}`) ? t(`roleNames.${r}`) : r)).join(" · ")}</p>

      <dl className="flex flex-wrap gap-x-12 gap-y-6 border-y border-frame py-6">
        {numbers.filter(([, v]) => v != null).map(([k, v]) => <div key={k}><dt className="text-sm text-ink-3">{t(`dash.${k}`)}</dt><dd className="tnum font-display text-4xl font-bold tracking-[-0.03em]">{v}</dd></div>)}
      </dl>

      <div className="mt-12 grid gap-x-16 gap-y-12 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-2xl">{t("dash.review")} {data?.review_total ? <span className="text-ink-3">{data.review_total}</span> : null}</h2>
          {!data?.review_tasks?.length ? <p className="text-ink-3">{t("dash.noTasks")}</p> : (
            <ul>{data.review_tasks.map((r) => <li key={r.object_id} className="border-b border-frame first:border-t"><Link href={`/admin/r/${r.object_type}/${r.object_id}`} className="flex justify-between gap-4 py-3 no-underline hover:text-action"><span className="font-medium">{r.title}</span><span className="tnum text-sm text-ink-3">{new Date(r.updated_at).toLocaleDateString(locale)}</span></Link></li>)}</ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-2xl">{t("dash.recent")}</h2>
          <ul>{(data?.recent_actions ?? []).slice(0, 8).map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-x-4 border-b border-frame py-2.5 text-sm first:border-t"><span><span className="font-semibold">{a.action_type}</span> <span className="text-ink-3">{a.object_type}</span></span><span className="tnum text-ink-3">{a.actor} · {new Date(a.ts).toLocaleString(locale)}</span></li>)}</ul>
        </section>
      </div>

      {health.data && (
        <section className="mt-12">
          <h2 className="mb-3 text-2xl">{t("dash.health")}</h2>
          <ul className="flex flex-wrap gap-3">{(["db", "ollama", "embeddings"] as const).map((k) => { const s = health.data[k]?.status; return <li key={k} className="inline-flex items-center gap-2 rounded-full bg-mount-2 px-4 py-2"><span className={`size-2.5 rounded-full ${s === "ok" ? "bg-ok" : s === "degraded" ? "bg-warn" : "bg-bad"}`} />{k}</li>; })}</ul>
        </section>
      )}
    </div>
  );
}
