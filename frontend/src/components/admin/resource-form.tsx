"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { api, ApiError, type Schema } from "@/lib/api/client";
import { Link, useRouter } from "@/i18n/navigation";
import type { Field, Resource } from "@/lib/admin-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pick, STATUS_TONE } from "./common";
import { CategoryInput } from "./category-input";
import { RefSelect } from "./ref-select";
import { RichEditor } from "./rich-editor";
import { FilesPanel } from "./files-panel";
import { useAdmin } from "./admin-shell";

type Values = Record<string, unknown>;
const LANGS = ["ru", "kk", "en"] as const;
type Lang = (typeof LANGS)[number];
const FILE_TYPES = new Set(["document", "news", "branch", "exhibit"]);

function emptyFor(f: Field): unknown {
  if (f.type === "i18n" || f.type === "i18n-area" || f.type === "rich") return {};
  if (f.type === "bool") return false;
  if (f.type === "select") return f.options?.[0] ?? "";
  if (f.type === "json") return [];
  return f.type === "number" ? null : "";
}

/** Builds the API payload: empty optional values become null, JSON text is parsed. */
function payload(res: Resource, values: Values): { body: Values; bad?: string } {
  const body: Values = {};
  for (const f of res.fields) {
    const v = values[f.name];
    if (f.type === "i18n" || f.type === "i18n-area" || f.type === "rich") body[f.name] = Object.fromEntries(Object.entries((v as Record<string, string>) ?? {}).filter(([, x]) => x && x.trim()));
    else if (f.type === "number") body[f.name] = v === "" || v === null || v === undefined ? null : Number(v);
    else if (f.type === "json") {
      try { body[f.name] = typeof v === "string" ? JSON.parse(v || "[]") : v; } catch { return { body, bad: f.name }; }
    } else if (f.type === "bool") body[f.name] = !!v;
    else if (f.type === "text" || f.type === "category" || f.type === "date" || f.type === "ref") body[f.name] = v === "" || v === undefined ? (f.required ? "" : null) : v;
    else body[f.name] = v;
  }
  return { body };
}

export function ResourceForm({ res, id }: { res: Resource; id: string }) {
  const t = useTranslations("admin");
  const d = useTranslations("dict");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const { can } = useAdmin();
  const isNew = id === "new";
  const [values, setValues] = useState<Values>({});
  const [lang, setLang] = useState<Lang>((LANGS as readonly string[]).includes(locale) ? (locale as Lang) : "ru");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const obj = useQuery({ queryKey: ["admin-obj", res.key, id], enabled: !isNew, queryFn: () => api.get<Schema["ObjectOut"]>(`${res.base}/${id}`, { scope: "admin" }) });
  const history = useQuery({ queryKey: ["admin-history", res.objectType, id], enabled: !isNew, queryFn: () => api.get<Schema["HistoryEntry"][]>(`/api/admin/workflow/${res.objectType}/${id}/history`, { scope: "admin" }).catch(() => []) });

  useEffect(() => {
    const base: Values = {};
    for (const f of res.fields) base[f.name] = emptyFor(f);
    if (isNew) {
      for (const f of res.fields) if (params.get(f.name)) base[f.name] = params.get(f.name);
      setValues(base);
    } else if (obj.data) {
      const merged = { ...base, ...obj.data.values };
      for (const f of res.fields) if (f.type === "json" && typeof merged[f.name] !== "string") merged[f.name] = JSON.stringify(merged[f.name] ?? [], null, 1);
      setValues(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obj.data, isNew]);

  const set = (name: string, v: unknown) => setValues((x) => ({ ...x, [name]: v }));
  const setI18n = (name: string, v: string) => setValues((x) => ({ ...x, [name]: { ...((x[name] as Record<string, string>) ?? {}), [lang]: v } }));

  const fail = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 409) return setMessage({ ok: false, text: t("form.conflict") });
      if (err.status === 403) return setMessage({ ok: false, text: t("form.forbidden") });
      const detail = err.detail as { fields?: string[] } | string | null;
      const fields = typeof detail === "object" && detail?.fields ? detail.fields.join(", ") : typeof detail === "string" ? detail : "";
      if (err.status === 422 || err.status === 400) return setMessage({ ok: false, text: fields ? t("form.invalid", { fields }) : t("form.error") });
    }
    setMessage({ ok: false, text: t("form.error") });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { body, bad } = payload(res, values);
    if (bad) return setMessage({ ok: false, text: `${t(`f.${bad}`)}: ${t("form.badJson")}` });
    setBusy(true);
    setMessage(null);
    try {
      if (isNew) {
        const created = await api.post<Schema["ObjectOut"]>(res.base, { body, scope: "admin" });
        await qc.invalidateQueries({ queryKey: ["admin-list", res.key] });
        router.replace(`/admin/r/${res.key}/${created.id}`);
      } else {
        const updated = await api.patch<Schema["ObjectOut"]>(`${res.base}/${id}`, { body: { ...body, version: obj.data?.version }, scope: "admin" });
        qc.setQueryData(["admin-obj", res.key, id], updated);
        void qc.invalidateQueries({ queryKey: ["admin-list", res.key] });
        void history.refetch();
        setMessage({ ok: true, text: t("form.saved") });
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const transition = async (action: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await api.post(`/api/admin/workflow/${res.objectType}/${id}/transitions`, { body: { action, version: obj.data?.version, comment: comment || null }, scope: "admin" });
      setComment("");
      await obj.refetch();
      void history.refetch();
      void qc.invalidateQueries({ queryKey: ["admin-list", res.key] });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`${res.base}/${id}`, { scope: "admin" });
      await qc.invalidateQueries({ queryKey: ["admin-list", res.key] });
      router.replace(`/admin/r/${res.key}`);
    } catch (err) {
      setConfirmDelete(false);
      fail(err);
    }
  };

  const title = useMemo(() => pick(values.title ?? values.name ?? values.question ?? values.text, locale), [values, locale]);
  const hasI18n = res.fields.some((f) => f.type.startsWith("i18n") || f.type === "rich");
  const canEdit = can(res.group === "catalog" ? "catalog.edit" : res.key === "branch" ? "branches.edit" : "content.edit");
  const actions = obj.data?.available_actions ?? [];

  if (!isNew && obj.isLoading) return <div className="h-64 animate-pulse rounded-3xl bg-mount-2" aria-busy />;

  const input = (f: Field) => {
    const label = t(`f.${f.name}`);
    const fid = `f-${f.name}`;
    const v = values[f.name];
    switch (f.type) {
      case "text":
      case "date":
      case "number":
        return <input id={fid} className="field" type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"} step={f.type === "number" ? "any" : undefined} value={(v as string | number | null) ?? ""} onChange={(e) => set(f.name, e.target.value)} required={f.required} disabled={!canEdit} />;
      case "category":
        return <CategoryInput base={res.base} field={f.name} resource={res.key} value={(v as string) ?? ""} onChange={(x) => set(f.name, x)} disabled={!canEdit} />;
      case "textarea":
        return <textarea id={fid} className="field" rows={4} value={(v as string) ?? ""} onChange={(e) => set(f.name, e.target.value)} disabled={!canEdit} />;
      case "select":
        return <select id={fid} className="field" value={(v as string) ?? ""} onChange={(e) => set(f.name, e.target.value)} disabled={!canEdit}>{f.options?.map((o) => <option key={o} value={o}>{d.has(`docType.${o}`) && f.name === "doc_type" ? d(`docType.${o}`) : d.has(`access.${o}`) && f.name === "file_access" ? d(`access.${o}`) : o}</option>)}</select>;
      case "bool":
        return <label className="flex min-h-11 items-center gap-3"><input type="checkbox" role="switch" className="size-5" checked={!!v} onChange={(e) => set(f.name, e.target.checked)} disabled={!canEdit} /><span>{label}</span></label>;
      case "ref":
        return <RefSelect id={fid} kind={f.ref as "branch"} value={(v as string) || null} onChange={(x) => set(f.name, x ?? "")} />;
      case "i18n":
        return <input id={fid} className="field" lang={lang} value={((v as Record<string, string>) ?? {})[lang] ?? ""} onChange={(e) => setI18n(f.name, e.target.value)} disabled={!canEdit} />;
      case "i18n-area":
        return <textarea id={fid} className="field" lang={lang} rows={4} value={((v as Record<string, string>) ?? {})[lang] ?? ""} onChange={(e) => setI18n(f.name, e.target.value)} disabled={!canEdit} />;
      case "rich":
        return <RichEditor key={`${f.name}-${lang}-${obj.data?.version ?? 0}`} label={label} value={((v as Record<string, string>) ?? {})[lang] ?? ""} onChange={(html) => setI18n(f.name, html)} />;
      case "json":
        return <textarea id={fid} className="field font-mono text-sm" rows={5} value={typeof v === "string" ? v : JSON.stringify(v ?? [], null, 1)} onChange={(e) => set(f.name, e.target.value)} disabled={!canEdit} />;
    }
  };

  return (
    <form onSubmit={save}>
      <div className="sticky top-[3.75rem] z-30 -mx-[var(--gutter)] mb-8 border-b border-frame bg-paper/95 px-[var(--gutter)] py-3 backdrop-blur max-lg:top-[6rem]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/admin/r/${res.key}`} className="text-sm text-ink-3 no-underline hover:text-action">← {t(`res.${res.key}`)}</Link>
            <h1 className="truncate text-2xl md:text-3xl">{isNew ? t("list.create") : title || "—"}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {obj.data && <><Badge tone={STATUS_TONE[obj.data.workflow_status] ?? "neutral"}>{d.has(`workflow.${obj.data.workflow_status}`) ? d(`workflow.${obj.data.workflow_status}`) : obj.data.workflow_status}</Badge><span className="tnum text-sm text-ink-3">{t("form.version", { n: obj.data.version })}</span></>}
            {message && <span role="status" className={clsx("rounded-full px-3 py-1 text-sm", message.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>{message.text}</span>}
            {actions.map((a) => <Button key={a} type="button" variant={a === "publish" || a === "approve" ? "primary" : "secondary"} size="sm" disabled={busy} onClick={() => transition(a)}>{t.has(`actions.${a}`) ? t(`actions.${a}`) : a}</Button>)}
            {canEdit && <Button type="submit" disabled={busy}>{isNew ? t("form.create") : t("form.save")}</Button>}
          </div>
        </div>
      </div>

      {hasI18n && (
        <div role="tablist" className="mb-6 inline-flex rounded-full bg-mount-2 p-1">
          {LANGS.map((l) => <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)} className={clsx("h-9 rounded-full px-5 font-semibold transition-colors", lang === l ? "bg-paper shadow-lift" : "text-ink-3 hover:text-ink")}>{t(`lang.${l}`)}{obj.data?.translation_status && (obj.data.translation_status as Record<string, string>)[l] && <span className="ml-1.5 text-xs text-ink-3">{d.has(`translation.${(obj.data.translation_status as Record<string, string>)[l]}`) ? d(`translation.${(obj.data.translation_status as Record<string, string>)[l]}`) : ""}</span>}</button>)}
        </div>
      )}

      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
        {res.fields.map((f) => (
          <div key={f.name} className={clsx(f.type === "rich" || f.wide ? "md:col-span-2 xl:col-span-3" : f.type === "i18n-area" || f.type === "json" ? "md:col-span-2" : "")}>
            {f.type !== "bool" && <label htmlFor={`f-${f.name}`} className="label">{t(`f.${f.name}`)}{f.required && " *"}</label>}
            {input(f)}
          </div>
        ))}
      </div>

      {comment !== undefined && actions.length > 0 && (
        <label className="mt-8 block max-w-xl"><span className="label">{t("form.comment")}</span><input className="field" value={comment} onChange={(e) => setComment(e.target.value)} /></label>
      )}

      {res.key === "exhibition" && !isNew && <ExhibitsPanel exhibitionId={id} />}
      {!isNew && FILE_TYPES.has(res.objectType) && <FilesPanel ownerType={res.objectType} ownerId={id} />}

      {!isNew && (history.data?.length ?? 0) > 0 && (
        <section className="mt-12 border-t border-frame pt-8">
          <h2 className="mb-3 text-2xl">{t("form.history")}</h2>
          <ul>{history.data?.map((h) => <li key={h.id} className="flex flex-wrap gap-x-5 border-b border-frame py-2.5 text-sm first:border-t"><span className="tnum text-ink-3">{new Date(h.ts).toLocaleString(locale)}</span><span>{h.from_status ? `${d.has(`workflow.${h.from_status}`) ? d(`workflow.${h.from_status}`) : h.from_status} → ` : ""}{d.has(`workflow.${h.to_status}`) ? d(`workflow.${h.to_status}`) : h.to_status}</span><span className="tnum text-ink-3">v{h.version}</span>{h.comment && <span className="text-ink-2">{h.comment}</span>}</li>)}</ul>
        </section>
      )}

      {!isNew && can(res.group === "catalog" ? "catalog.edit" : "content.delete") && (
        <div className="mt-12 border-t border-frame pt-8">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-bad-soft px-5 py-4"><span>{t("form.deleteConfirm")}</span><Button type="button" variant="danger" size="sm" onClick={remove}>{t("form.yes")}</Button><Button type="button" variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>{t("form.no")}</Button></div>
          ) : <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}>{t("form.delete")}</Button>}
        </div>
      )}
    </form>
  );
}

function ExhibitsPanel({ exhibitionId }: { exhibitionId: string }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const { data } = useQuery({ queryKey: ["admin-exhibits", exhibitionId], queryFn: () => api.get<Schema["ObjectOut"][]>(`/api/admin/exhibitions/${exhibitionId}/exhibits`, { scope: "admin" }) });
  return (
    <section className="mt-12 border-t border-frame pt-8">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl">{t("res.exhibit")}</h2><Link href={`/admin/r/exhibit/new?exhibition_id=${exhibitionId}`} className="inline-flex h-10 items-center rounded-full bg-action px-5 font-semibold text-action-ink no-underline">{t("list.create")}</Link></div>
      <ol className="list-decimal pl-6">
        {(data ?? []).map((e) => <li key={e.id} className="border-b border-frame py-2.5"><Link href={`/admin/r/exhibit/${e.id}`} className="font-medium no-underline hover:text-action">{pick((e.values as Values).title, locale) || "—"}</Link></li>)}
      </ol>
    </section>
  );
}
