"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api, ApiError, buildUrl, csrfHeaders, type Schema } from "@/lib/api/client";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AdminImport() {
  const t = useTranslations("admin");
  const io = useTranslations("admin.io");
  const file = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<Schema["ImportReportOut"] | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = useQuery({ queryKey: ["import-fields"], queryFn: () => api.get<Schema["ImportFieldsOut"]>("/api/admin/import/fields", { scope: "admin" }) });

  const send = async (apply: boolean) => {
    const f = file.current?.files?.[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const qs: Record<string, string> = {};
      if (Object.keys(mapping).length) qs.mapping = JSON.stringify(mapping);
      const res = await fetch(buildUrl(apply ? "/api/admin/import/apply" : "/api/admin/import/preview", qs), { method: "POST", credentials: "include", headers: { "Content-Type": f.type || "application/octet-stream", ...csrfHeaders("admin") }, body: f });
      if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
      const r = (await res.json()) as Schema["ImportReportOut"];
      setReport(r);
      if (!Object.keys(mapping).length) setMapping(r.mapping as Record<string, string>);
    } catch {
      setError(t("form.error"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <h1 className="mb-8 text-4xl">{t("res.import")}</h1>
      <div className="mb-12 flex flex-wrap gap-3">
        <a href={buildUrl("/api/admin/export/documents", { format: "xlsx" })} className={buttonClass("secondary")}><Download size={16} aria-hidden /> XLSX</a>
        <a href={buildUrl("/api/admin/export/documents", { format: "csv" })} className={buttonClass("secondary")}><Download size={16} aria-hidden /> CSV</a>
        <span className="self-center text-ink-3">{io("export")}</span>
      </div>
      <h2 className="mb-3 text-2xl">{io("import")}</h2>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={file} type="file" accept=".csv,.xlsx" className="field !w-auto" aria-label={io("file")} onChange={() => { setReport(null); setMapping({}); }} />
        <Button onClick={() => send(false)} disabled={busy}>{io("check")}</Button>
        {report && !report.applied && <Button variant="secondary" onClick={() => send(true)} disabled={busy}>{io("apply")}</Button>}
      </div>
      {fields.data && <p className="mt-3 text-sm text-ink-3">{fields.data.required.join(", ")} · max {fields.data.max_rows}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-bad">{error}</p>}
      {report && (
        <div className="mt-8">
          {report.applied && <p className="mb-4 rounded-xl bg-ok-soft px-4 py-3 text-ok">{io("done")}</p>}
          <h3 className="mb-3 text-xl">{io("mapping")}</h3>
          <ul className="mb-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{report.headers.map((h, i) => <li key={i} className="flex items-center gap-3"><span className="w-40 shrink-0 truncate text-sm">{h}</span><select className="field" value={mapping[String(i)] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [String(i)]: e.target.value }))} aria-label={h}><option value="" /> {report.fields.map((f) => <option key={f} value={f}>{f}</option>)}</select></li>)}</ul>
          <p className="mb-3 text-ink-3">{io("rows", { count: report.rows.length })} · {Object.entries(report.counts as Record<string, number>).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
          <ul>{report.rows.slice(0, 100).map((r) => <li key={r.line} className="flex flex-wrap items-center gap-3 border-b border-frame py-2 text-sm first:border-t"><span className="tnum w-12 text-ink-3">{r.line}</span><span className="code w-52">{r.archive_code}</span><Badge tone={r.action === "error" ? "bad" : r.action === "skip" ? "neutral" : "ok"}>{r.action}</Badge>{r.errors.length > 0 && <span className="text-bad">{r.errors.map((e) => e.code ?? JSON.stringify(e)).join(", ")}</span>}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
