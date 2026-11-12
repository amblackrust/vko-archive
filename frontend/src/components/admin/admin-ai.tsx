"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { api, type Schema } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { pick } from "./common";

const A = { scope: "admin" as const };

/** Staff AI helpers: pick a document, analyze its text, draft and approve a short annotation. */
export function AdminAi() {
  const t = useTranslations("admin");
  const locale = useLocale() as "kk" | "ru" | "en";
  const [q, setQ] = useState("");
  const [docId, setDocId] = useState<string | null>(null);
  const status = useQuery({ queryKey: ["ai-status"], queryFn: () => api.get<Schema["AiToolsStatus"]>("/api/admin/ai-tools/status", A) });
  const docs = useQuery({ queryKey: ["ai-docs", q], enabled: q.length > 1, queryFn: () => api.get<Schema["ListPage"]>("/api/admin/catalog/document", { query: { q, page_size: 8 }, ...A }) });
  const analyze = useMutation({ mutationFn: () => api.post<Schema["AnalysisOut"]>(`/api/admin/ai-tools/documents/${docId}/analyze`, { body: { lang: locale }, ...A }) });
  const draft = useMutation({ mutationFn: () => api.post<Schema["AnnotationOut"]>(`/api/admin/ai-tools/documents/${docId}/annotations/generate`, { body: { lang: locale }, ...A }) });
  const approve = useMutation({ mutationFn: () => api.post(`/api/admin/ai-tools/documents/${docId}/annotations/${locale}/approve`, A) });
  const a = analyze.data;
  return (
    <div>
      <h1 className="mb-2 text-4xl">{t("res.ai")}</h1>
      {status.data && !status.data.ai_available && <p className="mb-6 text-warn">{status.data.reason ?? "AI unavailable"}</p>}
      <div className="mb-8 max-w-xl">
        <input className="field !rounded-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("list.search")} aria-label={t("list.search")} />
        <ul className="mt-2">{docs.data?.items.map((d) => <li key={d.id}><button type="button" onClick={() => { setDocId(d.id); setQ(""); }} className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-mount-2"><span className="text-sm text-ink-3">{d.number}</span> <span className="font-medium">{pick(d.title, locale)}</span></button></li>)}</ul>
      </div>
      {docId && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => analyze.mutate()} disabled={analyze.isPending}><Sparkles size={16} aria-hidden /> Analyze</Button>
          <Button variant="secondary" onClick={() => draft.mutate()} disabled={draft.isPending}>Annotation</Button>
          {draft.data && <Button variant="secondary" onClick={() => approve.mutate()}>{approve.isSuccess ? "✓" : t("actions.approve")}</Button>}
        </div>
      )}
      {draft.data && <p className="mt-6 max-w-[70ch] whitespace-pre-line rounded-2xl bg-mount-2 p-5 text-lg">{draft.data.text}</p>}
      {a && (
        <dl className="mt-8 grid gap-x-10 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          {([["dates", a.dates], ["persons", a.persons], ["organizations", a.organizations], ["places", a.places], ["events", a.events], ["topics", a.topics]] as const).map(([k, v]) => v.length > 0 && <div key={k}><dt className="text-sm text-ink-3">{k}</dt><dd className="mt-1 flex flex-wrap gap-1.5">{v.map((x) => <span key={x} className="rounded-full bg-action-soft px-3 py-1 text-sm text-action">{x}</span>)}</dd></div>)}
          {a.summary && <div className="md:col-span-2 xl:col-span-3"><dt className="text-sm text-ink-3">summary</dt><dd className="mt-1 max-w-[70ch]">{a.summary}</dd></div>}
        </dl>
      )}
    </div>
  );
}
