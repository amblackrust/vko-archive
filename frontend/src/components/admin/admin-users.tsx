"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import clsx from "clsx";
import { api, ApiError, type Schema } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdmin } from "./admin-shell";

const ROLES = ["super_admin", "site_admin", "editor", "archivist", "branch_admin", "moderator", "analyst"];

export function AdminUsers() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const { can } = useAdmin();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Schema["UserOut"] | "new" | null>(null);
  const { data } = useQuery({ queryKey: ["admin-users", q], queryFn: () => api.get<Schema["UserPage"]>("/api/admin/users", { query: { q, page_size: 100 }, scope: "admin" }) });
  const done = () => { setEditing(null); void qc.invalidateQueries({ queryKey: ["admin-users"] }); };
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h1 className="text-4xl">{t("res.users")}</h1>{can("users.manage") && <Button onClick={() => setEditing("new")}><Plus size={17} aria-hidden /> {t("users.new")}</Button>}</div>
      <input className="field mb-4 !max-w-sm !rounded-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("list.search")} aria-label={t("list.search")} />
      <table className="w-full border-collapse text-left">
        <thead className="text-sm text-ink-3"><tr className="border-b border-frame-strong"><th className="py-2 pr-4 font-semibold">{t("users.fullName")}</th><th className="py-2 pr-4 font-semibold max-md:hidden">{t("users.email")}</th><th className="py-2 pr-4 font-semibold">{t("users.roles")}</th><th className="py-2 font-semibold max-lg:hidden">{t("users.last")}</th></tr></thead>
        <tbody>{data?.items.map((u) => (
          <tr key={u.id} className="border-b border-frame">
            <td className="py-3 pr-4"><button type="button" className="font-display text-lg font-semibold hover:text-action" onClick={() => setEditing(u)}>{u.full_name}</button>{!u.is_active && <span className="ml-2"><Badge tone="bad">{t("users.active")}: ×</Badge></span>}{u.is_locked && <span className="ml-2"><Badge tone="warn">{t("users.locked")}</Badge></span>}</td>
            <td className="py-3 pr-4 text-ink-2 max-md:hidden">{u.email}</td>
            <td className="py-3 pr-4 text-sm">{u.roles.map((r) => (t.has(`roleNames.${r}`) ? t(`roleNames.${r}`) : r)).join(", ")}</td>
            <td className="tnum py-3 text-sm text-ink-3 max-lg:hidden">{u.last_login_at ? new Date(u.last_login_at).toLocaleString(locale) : "—"}</td>
          </tr>
        ))}</tbody>
      </table>
      {editing && <UserSheet user={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={done} manage={can("users.manage")} />}
    </div>
  );
}

function UserSheet({ user, onClose, onDone, manage }: { user: Schema["UserOut"] | null; onClose: () => void; onDone: () => void; manage: boolean }) {
  const t = useTranslations("admin");
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.full_name ?? "");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>(user?.roles ?? ["editor"]);
  const [active, setActive] = useState(user?.is_active ?? true);
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      if (!user) return api.post("/api/admin/users", { body: { email, full_name: name, password, roles, branch_id: null }, scope: "admin" });
      await api.patch(`/api/admin/users/${user.id}`, { body: { email, full_name: name, is_active: active }, scope: "admin" });
      await api.put(`/api/admin/users/${user.id}/roles`, { body: { roles }, scope: "admin" });
      if (password) await api.post(`/api/admin/users/${user.id}/password`, { body: { new_password: password }, scope: "admin" });
    },
    onSuccess: onDone,
    onError: (e) => setErr(e instanceof ApiError && e.status === 403 ? t("form.forbidden") : t("form.error")),
  });
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex h-full w-[min(28rem,100vw)] flex-col gap-4 overflow-y-auto border-l border-frame bg-paper p-6 shadow-lift-high">
        <h2 className="text-2xl">{user ? user.full_name : t("users.new")}</h2>
        <label className="block"><span className="label">{t("users.fullName")}</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} required disabled={!manage} /></label>
        <label className="block"><span className="label">{t("users.email")}</span><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!manage} /></label>
        {manage && <label className="block"><span className="label">{user ? t("users.resetPassword") : t("users.password")}</span><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!user} minLength={user && !password ? 0 : 10} autoComplete="new-password" /></label>}
        <fieldset><legend className="label">{t("users.roles")}</legend><div className="flex flex-wrap gap-2">{ROLES.map((r) => <button key={r} type="button" aria-pressed={roles.includes(r)} disabled={!manage} onClick={() => setRoles((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))} className={clsx("h-9 rounded-full px-4 text-sm font-semibold transition-colors", roles.includes(r) ? "bg-action text-action-ink" : "bg-mount-2 text-ink-2")}>{t.has(`roleNames.${r}`) ? t(`roleNames.${r}`) : r}</button>)}</div></fieldset>
        {user && <label className="flex items-center gap-3"><input type="checkbox" role="switch" className="size-5" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={!manage} />{t("users.active")}</label>}
        {err && <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-bad">{err}</p>}
        <div className="mt-auto flex gap-2">{manage && <Button type="submit" disabled={save.isPending}>{t("form.save")}</Button>}<Button type="button" variant="secondary" onClick={onClose}>{t("form.cancel")}</Button></div>
      </form>
    </div>
  );
}
