"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Schema } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { pick } from "./common";
import { useAdmin } from "./admin-shell";

export function AdminRoles() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const { me } = useAdmin();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-roles"], queryFn: () => api.get<Schema["RoleMatrixResponse"]>("/api/admin/roles", { scope: "admin" }) });
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({});
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => { if (data) setMatrix(Object.fromEntries(data.roles.map((r) => [r.code, new Set(r.permissions)]))); }, [data]);
  const modules = useMemo(() => [...new Set((data?.permissions ?? []).map((p) => p.module))], [data]);
  if (!data) return null;
  const toggle = (code: string, key: string) => setMatrix((m) => { const s = new Set(m[code]); if (s.has(key)) s.delete(key); else s.add(key); return { ...m, [code]: s }; });
  const save = async (code: string) => { await api.put(`/api/admin/roles/${code}/permissions`, { body: { permissions: [...matrix[code]] }, scope: "admin" }); setSaved(code); void qc.invalidateQueries({ queryKey: ["admin-roles"] }); setTimeout(() => setSaved(null), 1500); };
  return (
    <div>
      <h1 className="mb-6 text-4xl">{t("res.roles")}</h1>
      {!me.is_super && <p className="mb-4 text-ink-3">{t("roles.readonly")}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <thead><tr className="border-b border-frame-strong text-sm"><th className="py-2 pr-4 font-semibold">{t("roles.module")}</th>{data.roles.map((r) => <th key={r.code} className="px-3 py-2 text-center font-semibold">{pick(r.name, locale) || r.code}</th>)}</tr></thead>
          <tbody>
            {modules.map((mod) => (
              <Fragment key={mod}>
                <tr className="bg-mount"><td colSpan={data.roles.length + 1} className="px-0 py-2 font-display text-lg font-bold">{mod}</td></tr>
                {data.permissions.filter((p) => p.module === mod).map((p) => (
                  <tr key={p.key} className="border-b border-frame"><td className="py-2 pr-4 text-sm">{p.action}</td>{data.roles.map((r) => <td key={r.code} className="px-3 py-2 text-center"><input type="checkbox" className="size-5" aria-label={`${r.code} ${p.key}`} checked={matrix[r.code]?.has(p.key) ?? false} onChange={() => toggle(r.code, p.key)} disabled={!me.is_super || r.code === "super_admin"} /></td>)}</tr>
                ))}
              </Fragment>
            ))}
          </tbody>
          {me.is_super && <tfoot><tr><td />{data.roles.map((r) => <td key={r.code} className="px-3 py-3 text-center">{r.code !== "super_admin" && <Button size="sm" variant={saved === r.code ? "secondary" : "primary"} onClick={() => save(r.code)}>{saved === r.code ? "✓" : t("form.save")}</Button>}</td>)}</tr></tfoot>}
        </table>
      </div>
    </div>
  );
}
