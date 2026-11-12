"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Trash2, X } from "lucide-react";
import { api, ApiError, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AuthForms } from "./auth-forms";

const TABS = ["favorites", "selections", "searches", "subscriptions", "account"] as const;
type Tab = (typeof TABS)[number];
const V = { scope: "visitor" as const };

export function CabinetApp() {
  const t = useTranslations("cabinet");
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("favorites");
  const me = useQuery({ queryKey: ["visitor"], retry: false, queryFn: () => api.get<Schema["VisitorMe"]>("/api/cabinet/me", V).catch((e) => (e instanceof ApiError && e.status === 401 ? null : Promise.reject(e))) });

  if (me.isLoading) return <div className="mx-auto h-64 max-w-md animate-pulse rounded-3xl bg-mount-2" aria-busy />;
  if (!me.data) return <AuthForms />;

  const logout = async () => {
    await api.post("/api/cabinet/auth/logout", V).catch(() => undefined);
    qc.setQueryData(["visitor"], null);
    qc.removeQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("cab-") });
  };

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xl"><span className="font-semibold">{me.data.display_name}</span> <span className="text-ink-3">{me.data.email}</span></p>
        <Button variant="secondary" onClick={logout}>{t("logout")}</Button>
      </div>
      {!me.data.email_confirmed && <ConfirmBanner />}
      <div role="tablist" className="mb-8 flex flex-wrap gap-2">
        {TABS.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={clsx("inline-flex h-11 items-center rounded-full px-5 font-semibold transition-colors", tab === x ? "bg-ink text-paper" : "bg-mount-2 text-ink-2 hover:text-ink")}>{t(`tabs.${x}`)}</button>
        ))}
      </div>
      {tab === "favorites" && <Favorites />}
      {tab === "selections" && <Selections />}
      {tab === "searches" && <Searches />}
      {tab === "subscriptions" && <Subs />}
      {tab === "account" && <Account onGone={() => qc.setQueryData(["visitor"], null)} />}
    </div>
  );
}

function ConfirmBanner() {
  const t = useTranslations("cabinet.confirmEmail");
  const locale = useLocale();
  const [sent, setSent] = useState(false);
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warn-soft px-5 py-3">
      <p>{t("banner")}</p>
      <Button size="sm" variant="secondary" disabled={sent} onClick={() => api.post("/api/cabinet/auth/email/resend", { body: { lang: locale }, ...V }).then(() => setSent(true)).catch(() => undefined)}>{sent ? t("sent") : t("resend")}</Button>
    </div>
  );
}

function Favorites() {
  const t = useTranslations("cabinet");
  const c = useTranslations("common");
  const locale = useLocale();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["cab-fav", locale], queryFn: () => api.get<Schema["FavoriteItem"][]>("/api/cabinet/favorites", { query: { lang: locale }, ...V }) });
  const del = useMutation({ mutationFn: (f: Schema["FavoriteItem"]) => api.delete(`/api/cabinet/favorites/${f.type}/${f.id}`, V), onSuccess: () => qc.invalidateQueries({ queryKey: ["cab-fav"] }) });
  if (!data) return null;
  if (!data.length) return <EmptyState title={t("empty.favorites")} />;
  return (
    <ul>
      {data.map((f) => (
        <li key={f.type + f.id} className="flex items-center justify-between gap-4 border-b border-frame py-4 first:border-t">
          <Link href={f.href} className="min-w-0 no-underline hover:text-action"><span className="edge mr-3">{c.has(`types.${f.type}`) ? c(`types.${f.type}`) : f.type}</span><span className="font-display text-xl font-semibold tracking-[-0.02em]">{f.title}</span></Link>
          <button type="button" onClick={() => del.mutate(f)} aria-label={t("remove")} title={t("remove")} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-mount-2 hover:text-bad"><X size={18} /></button>
        </li>
      ))}
    </ul>
  );
}

function Selections() {
  const t = useTranslations("cabinet");
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const { data } = useQuery({ queryKey: ["cab-sel"], queryFn: () => api.get<Schema["Selection"][]>("/api/cabinet/selections", V) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["cab-sel"] });
  const create = useMutation({ mutationFn: () => api.post("/api/cabinet/selections", { body: { title }, ...V }), onSuccess: () => { setTitle(""); void refresh(); } });
  const drop = useMutation({ mutationFn: (id: string) => api.delete(`/api/cabinet/selections/${id}`, V), onSuccess: refresh });
  const dropDoc = useMutation({ mutationFn: ({ s, d }: { s: string; d: string }) => api.delete(`/api/cabinet/selections/${s}/items/${d}`, V), onSuccess: refresh });
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate(); }} className="mb-8 flex max-w-xl gap-2">
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("selections.new")} maxLength={120} aria-label={t("selections.new")} />
        <Button type="submit" disabled={!title.trim()}>{t("selections.create")}</Button>
      </form>
      {data && !data.length && <EmptyState title={t("empty.selections")}>{t("selections.noDocs")}</EmptyState>}
      <ul className="space-y-8">
        {data?.map((s) => (
          <li key={s.id}>
            <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-2xl">{s.title} <span className="text-base font-normal text-ink-3">{t("selections.documents", { count: s.documents.length })}</span></h3><button type="button" onClick={() => drop.mutate(s.id)} aria-label={t("remove")} title={t("remove")} className="grid size-10 place-items-center rounded-full text-ink-3 hover:bg-mount-2 hover:text-bad"><Trash2 size={17} /></button></div>
            <ul>{s.documents.map((d) => <li key={d.id} className="flex items-center justify-between gap-3 border-b border-frame py-3 first:border-t"><Link href={d.href} className="no-underline hover:text-action"><span className="edge mr-3">{d.archive_code}</span>{d.title}</Link><button type="button" onClick={() => dropDoc.mutate({ s: s.id, d: d.id })} aria-label={t("remove")} className="text-ink-3 hover:text-bad"><X size={16} /></button></li>)}</ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Searches() {
  const t = useTranslations("cabinet");
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["cab-search"], queryFn: () => api.get<Schema["SearchEntry"][]>("/api/cabinet/searches", V) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["cab-search"] });
  const drop = useMutation({ mutationFn: (id: string) => api.delete(`/api/cabinet/searches/${id}`, V), onSuccess: refresh });
  const clear = useMutation({ mutationFn: () => api.delete("/api/cabinet/searches", V), onSuccess: refresh });
  if (!data) return null;
  if (!data.length) return <EmptyState title={t("empty.searches")} />;
  return (
    <div>
      <ul>{data.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 border-b border-frame py-3 first:border-t"><Link href={s.href} className="text-lg no-underline hover:text-action">{s.query}</Link><button type="button" onClick={() => drop.mutate(s.id)} aria-label={t("remove")} className="text-ink-3 hover:text-bad"><X size={16} /></button></li>)}</ul>
      <Button variant="ghost" className="mt-4" onClick={() => clear.mutate()}>{t("searches.clear")}</Button>
    </div>
  );
}

function Subs() {
  const t = useTranslations("cabinet.subs");
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["cab-subs"], queryFn: () => api.get<Schema["Subscriptions"]>("/api/cabinet/subscriptions", V) });
  const toggle = useMutation({ mutationFn: ({ topic, on }: { topic: string; on: boolean }) => (on ? api.put(`/api/cabinet/subscriptions/${topic}`, V) : api.delete(`/api/cabinet/subscriptions/${topic}`, V)), onSuccess: () => qc.invalidateQueries({ queryKey: ["cab-subs"] }) });
  return (
    <ul className="max-w-xl">
      {(["news", "exhibitions"] as const).map((topic) => {
        const on = !!data?.topics.includes(topic);
        return (
          <li key={topic} className="border-b border-frame first:border-t"><label className="flex cursor-pointer items-center justify-between gap-4 py-5 text-lg"><span>{t(topic)}</span><input type="checkbox" role="switch" className="size-6" checked={on} onChange={(e) => toggle.mutate({ topic, on: e.target.checked })} /></label></li>
        );
      })}
    </ul>
  );
}

function Account({ onGone }: { onGone: () => void }) {
  const t = useTranslations("cabinet.account");
  const e = useTranslations("cabinet.errors");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const change = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      await api.post("/api/cabinet/auth/password", { body: { current_password: cur, new_password: next }, ...V });
      setMsg({ ok: true, text: t("changed") });
      setCur(""); setNext("");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError && err.status === 422 ? e("weak") : err instanceof ApiError && err.status === 401 ? e("credentials") : e("generic") });
    }
  };
  return (
    <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
      <form onSubmit={change} className="max-w-md space-y-4">
        <h3 className="text-2xl">{t("changePassword")}</h3>
        <label className="block"><span className="label">{t("current")}</span><input className="field" type="password" value={cur} onChange={(x) => setCur(x.target.value)} autoComplete="current-password" required /></label>
        <label className="block"><span className="label">{t("new")}</span><input className="field" type="password" value={next} onChange={(x) => setNext(x.target.value)} autoComplete="new-password" required minLength={8} /></label>
        {msg && <p role="status" className={clsx("rounded-xl px-4 py-3", msg.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>{msg.text}</p>}
        <Button type="submit">{t("changePassword")}</Button>
      </form>
      <div className="max-w-md">
        {confirm ? (
          <div className="rounded-2xl bg-bad-soft p-5"><p>{t("deleteConfirm")}</p><div className="mt-4 flex gap-2"><Button variant="danger" onClick={() => api.delete("/api/cabinet/me", V).then(onGone)}>{t("deleteYes")}</Button><Button variant="secondary" onClick={() => setConfirm(false)}>×</Button></div></div>
        ) : <Button variant="outline" onClick={() => setConfirm(true)}>{t("delete")}</Button>}
      </div>
    </div>
  );
}
