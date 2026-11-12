"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { api, buildUrl, type Schema } from "@/lib/api/client";
import { Button, buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

const A = { scope: "admin" as const };

export function AdminAudit() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [f, setF] = useState({ q: "", action_type: "", result: "", date_from: "", date_to: "" });
  const [page, setPage] = useState(1);
  const query = { ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page, page_size: 30 };
  const { data } = useQuery({ queryKey: ["admin-audit", f, page], queryFn: () => api.get<Schema["AuditPage"]>("/api/admin/audit", { query, ...A }) });
  const exportUrl = buildUrl("/api/admin/audit/export", Object.fromEntries(Object.entries(f).filter(([, v]) => v)));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h1 className="text-4xl">{t("res.audit")}</h1><a href={exportUrl} className={buttonClass("secondary")}><Download size={16} aria-hidden /> {t("audit.export")}</a></div>
      <div className="mb-5 flex flex-wrap gap-3">
        <input className="field !w-64 !rounded-full" value={f.q} onChange={(e) => { setF({ ...f, q: e.target.value }); setPage(1); }} placeholder={t("list.search")} aria-label={t("list.search")} />
        <select className="field !w-auto" value={f.result} onChange={(e) => { setF({ ...f, result: e.target.value }); setPage(1); }} aria-label={t("audit.result")}><option value="">{t("audit.result")}</option>{["success", "failure", "denied"].map((r) => <option key={r} value={r}>{r}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-ink-3">{t("audit.from")}<input type="date" className="field !w-auto" value={f.date_from} onChange={(e) => { setF({ ...f, date_from: e.target.value }); setPage(1); }} /></label>
        <label className="flex items-center gap-2 text-sm text-ink-3">{t("audit.to")}<input type="date" className="field !w-auto" value={f.date_to} onChange={(e) => { setF({ ...f, date_to: e.target.value }); setPage(1); }} /></label>
      </div>
      <table className="w-full border-collapse text-left text-sm">
        <thead className="text-ink-3"><tr className="border-b border-frame-strong"><th className="py-2 pr-4 font-semibold">{t("audit.when")}</th><th className="py-2 pr-4 font-semibold">{t("audit.who")}</th><th className="py-2 pr-4 font-semibold">{t("audit.action")}</th><th className="py-2 pr-4 font-semibold max-md:hidden">{t("audit.object")}</th><th className="py-2 font-semibold">{t("audit.result")}</th></tr></thead>
        <tbody>{data?.items.map((a) => <tr key={a.id} className="border-b border-frame"><td className="tnum whitespace-nowrap py-2.5 pr-4 text-ink-3">{new Date(a.ts).toLocaleString(locale)}</td><td className="py-2.5 pr-4">{a.actor ?? "—"}</td><td className="py-2.5 pr-4 font-semibold">{a.action_type}</td><td className="py-2.5 pr-4 text-ink-3 max-md:hidden">{a.object_type}</td><td className="py-2.5"><Badge tone={a.result === "success" ? "ok" : "bad"}>{a.result}</Badge></td></tr>)}</tbody>
      </table>
      <div className="mt-5 flex items-center justify-between"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</Button><span className="tnum text-sm text-ink-3">{page} / {pages}</span><Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>›</Button></div>
    </div>
  );
}

export function AdminAnalytics() {
  const t = useTranslations("admin.analytics");
  const [days, setDays] = useState(30);
  const { data } = useQuery({ queryKey: ["admin-analytics", days], queryFn: () => api.get<Schema["AnalyticsReport"]>("/api/admin/analytics", { query: { days }, ...A }) });
  const summary = useMutation({ mutationFn: () => api.post<Schema["AiSummaryOut"]>("/api/admin/analytics/ai-summary", { query: { days }, ...A }) });
  const max = Math.max(...(data?.per_day ?? []).map((d) => d.searches), 1);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><AnalyticsTitle /><select className="field !w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t("days")}>{[7, 30, 90].map((d) => <option key={d} value={d}>{d} {t("days")}</option>)}</select></div>
      {data && (
        <>
          <dl className="flex flex-wrap gap-x-12 gap-y-4 border-y border-frame py-6"><div><dt className="text-sm text-ink-3">{t("total")}</dt><dd className="tnum font-display text-4xl font-bold">{data.total_searches}</dd></div><div><dt className="text-sm text-ink-3">{t("zero")}</dt><dd className="tnum font-display text-4xl font-bold">{data.zero_result_searches} <span className="text-xl text-ink-3">{Math.round(data.zero_result_rate * 100)}%</span></dd></div></dl>
          <div className="mt-8 flex h-32 items-end gap-1" role="img" aria-label={t("total")}>{data.per_day.map((d) => <div key={d.day} title={`${d.day}: ${d.searches}`} className="flex-1 rounded-t bg-action/70" style={{ height: `${(d.searches / max) * 100}%`, minHeight: 2 }} />)}</div>
          <div className="mt-12 grid gap-x-16 gap-y-10 lg:grid-cols-2">
            <section><h2 className="mb-3 text-2xl">{t("top")}</h2><ul>{data.top_queries.map((q) => <li key={q.query} className="flex justify-between gap-4 border-b border-frame py-2.5 first:border-t"><span>{q.query}</span><span className="tnum text-ink-3">{q.count}</span></li>)}</ul></section>
            <section><h2 className="mb-3 text-2xl">{t("zeroList")}</h2><ul>{data.zero_queries.map((q) => <li key={q.query} className="flex justify-between gap-4 border-b border-frame py-2.5 first:border-t"><span>{q.query}</span><span className="tnum text-ink-3">{q.count}</span></li>)}</ul></section>
          </div>
          <section className="mt-12"><Button variant="secondary" onClick={() => summary.mutate()} disabled={summary.isPending}>{t("make")}</Button>{summary.data && <p className="mt-4 max-w-[70ch] whitespace-pre-line text-lg">{summary.data.available ? summary.data.text : summary.data.reason}</p>}</section>
        </>
      )}
    </div>
  );
}

export function AdminSettings() {
  const t = useTranslations("admin");
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-settings"], queryFn: () => api.get<Record<string, unknown>>("/api/admin/settings", A) });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  if (!data) return null;
  const save = async (key: string) => {
    try { await api.put(`/api/admin/settings/${key}`, { body: { value: JSON.parse(draft[key] ?? JSON.stringify(data[key])) }, ...A }); setMsg(key); void qc.invalidateQueries({ queryKey: ["admin-settings"] }); setTimeout(() => setMsg(null), 1500); } catch { setMsg("!"); }
  };
  return (
    <div>
      <h1 className="mb-2 text-4xl">{t("res.settings")}</h1><p className="mb-8 text-ink-3">{t("settings.hint")}</p>
      <ul className="space-y-6">{Object.entries(data).map(([key, value]) => (
        <li key={key} className="grid gap-x-8 gap-y-2 border-t border-frame pt-5 lg:grid-cols-[14rem_minmax(0,1fr)_auto]">
          <label htmlFor={`s-${key}`} className="font-display text-lg font-bold">{key}</label>
          <textarea id={`s-${key}`} className="field font-mono text-sm" rows={Math.min(10, Math.max(2, JSON.stringify(value, null, 1).split("\n").length))} defaultValue={JSON.stringify(value, null, 1)} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
          <div><Button size="sm" onClick={() => save(key)}>{msg === key ? "✓" : t("form.save")}</Button></div>
        </li>
      ))}</ul>
    </div>
  );
}

export function AdminSynonyms() {
  const t = useTranslations("admin");
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-syn"], queryFn: () => api.get<Record<string, unknown>[]>("/api/admin/synonyms", A) });
  const [term, setTerm] = useState("");
  const [variants, setVariants] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-syn"] });
  const add = useMutation({ mutationFn: () => api.post("/api/admin/synonyms", { body: { term, variants: variants.split(",").map((x) => x.trim()).filter(Boolean) }, ...A }), onSuccess: () => { setTerm(""); setVariants(""); void refresh(); } });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/api/admin/synonyms/${id}`, A), onSuccess: refresh });
  return (
    <div>
      <h1 className="mb-6 text-4xl">{t("res.synonyms")}</h1>
      <form onSubmit={(e) => { e.preventDefault(); if (term.trim()) add.mutate(); }} className="mb-8 flex flex-wrap gap-3"><input className="field !w-56" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t("syn.term")} aria-label={t("syn.term")} /><input className="field !w-96 !max-w-full" value={variants} onChange={(e) => setVariants(e.target.value)} placeholder={t("syn.variants")} aria-label={t("syn.variants")} /><Button type="submit">{t("syn.add")}</Button></form>
      {data?.length === 0 && <EmptyState title={t("list.empty")} />}
      <ul>{data?.map((s) => <li key={String(s.id)} className="flex items-center justify-between gap-4 border-b border-frame py-3 first:border-t"><span><span className="font-display text-lg font-bold">{String(s.term)}</span> <span className="text-ink-2">{Array.isArray(s.variants) ? (s.variants as string[]).join(", ") : String(s.variants ?? "")}</span></span><button type="button" onClick={() => del.mutate(String(s.id))} aria-label={t("form.delete")} className="grid size-10 place-items-center rounded-full text-ink-3 hover:bg-mount-2 hover:text-bad"><Trash2 size={17} /></button></li>)}</ul>
    </div>
  );
}

export function AdminTranslations() {
  const t = useTranslations("admin");
  const d = useTranslations("dict");
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ["admin-tr", q, page], queryFn: () => api.get<Schema["TranslationPage"]>("/api/admin/translations", { query: { q, page, page_size: 25 }, ...A }) });
  const machine = useMutation({ mutationFn: ({ it, target }: { it: Schema["TranslationItem"]; target: string }) => api.post(`/api/admin/translations/${it.object_type}/${it.id}/machine`, { body: { source_lang: "ru", target_lang: target, version: it.version, overwrite: false }, ...A }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tr"] }) });
  const verify = useMutation({ mutationFn: ({ it, lang }: { it: Schema["TranslationItem"]; lang: string }) => api.post(`/api/admin/translations/${it.object_type}/${it.id}/verify`, { body: { lang, version: it.version }, ...A }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tr"] }) });
  return (
    <div>
      <h1 className="mb-6 text-4xl">{t("res.translations")}</h1>
      <input className="field mb-4 !max-w-sm !rounded-full" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t("list.search")} aria-label={t("list.search")} />
      <table className="w-full border-collapse text-left">
        <thead className="text-sm text-ink-3"><tr className="border-b border-frame-strong"><th className="py-2 pr-4 font-semibold">{t("tr.object")}</th>{(["ru", "kk", "en"] as const).map((l) => <th key={l} className="px-3 py-2 font-semibold">{t(`lang.${l}`)}</th>)}</tr></thead>
        <tbody>{data?.items.map((it) => (
          <tr key={it.id} className="border-b border-frame">
            <td className="py-3 pr-4"><Link href={`/admin/r/${it.object_type}/${it.id}`} className="font-medium no-underline hover:text-action">{it.label}</Link> <span className="text-sm text-ink-3">{it.object_type}</span></td>
            {(["ru", "kk", "en"] as const).map((l) => { const s = (it.translation_status as Record<string, string>)[l]; return (
              <td key={l} className="px-3 py-3 text-sm">
                <Badge tone={s === "verified" ? "ok" : s === "machine" ? "warn" : "neutral"}>{s && d.has(`translation.${s}`) ? d(`translation.${s}`) : "—"}</Badge>
                {l !== "ru" && s !== "verified" && <span className="ml-2 inline-flex gap-1"><button type="button" className="text-action" onClick={() => machine.mutate({ it, target: l })}>{t("tr.machine")}</button>{s === "machine" && <button type="button" className="text-action" onClick={() => verify.mutate({ it, lang: l })}>{t("tr.verify")}</button>}</span>}
              </td>
            ); })}
          </tr>
        ))}</tbody>
      </table>
      <div className="mt-5 flex justify-between"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</Button><Button variant="secondary" size="sm" disabled={!data || page * 25 >= data.total} onClick={() => setPage((p) => p + 1)}>›</Button></div>
    </div>
  );
}

function AnalyticsTitle() {
  const t = useTranslations("admin.res");
  return <h1 className="text-4xl">{t("analytics")}</h1>;
}
