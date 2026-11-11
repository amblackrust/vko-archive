"use client";

import { Fragment, useState } from "react";
import { Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { adminRequest, pickName } from "@/lib/api/admin";
import { useMe } from "../admin-provider";
import { ConfirmDialog } from "../kit/dialog";
import { useLoad } from "../kit/hooks";
import { LoadError, NoAccess, Notice } from "../kit/notice";
import { AdminPage } from "../kit/page";
import { useToast } from "../kit/toast";

interface RoleRow {
  id: string;
  code: string;
  name: Record<string, string>;
  is_system: boolean;
  permissions: string[];
}
interface Permission {
  key: string;
  module: string;
  action: string;
}
interface Matrix {
  roles: RoleRow[];
  permissions: Permission[];
}

/** Порядок ролей как в регламенте: от главного администратора к аналитику. */
const ROLE_ORDER = ["super_admin", "site_admin", "editor", "archivist", "branch_admin", "moderator", "analyst"];
const cell = "border-b px-3 py-2";

/** Матрица ролей и прав. Меняет только главный администратор: для остальных раздел закрыт, сервер проверяет право сам. */
export function RolesView() {
  const t = useTranslations("adminContent.roles");
  const locale = useLocale();
  const me = useMe();
  const toast = useToast();
  const matrix = useLoad(() => (me.is_super ? adminRequest<Matrix>("/roles") : Promise.resolve(null)), []);
  // Несохранённые правки: код роли → выбранный набор прав.
  const [edits, setEdits] = useState<Record<string, Set<string>>>({});
  const [confirm, setConfirm] = useState<RoleRow | null>(null);
  if (!me.is_super) return <NoAccess />;

  const roles = [...(matrix.data?.roles ?? [])].sort((a, b) => ROLE_ORDER.indexOf(a.code) - ROLE_ORDER.indexOf(b.code));
  const permissions = matrix.data?.permissions ?? [];
  const modules = [...new Set(permissions.map((permission) => permission.module))].map((module) => [module, permissions.filter((permission) => permission.module === module)] as const);
  const current = (role: RoleRow) => edits[role.code] ?? new Set(role.permissions);
  const roleName = (role: RoleRow) => pickName(role.name, locale);
  const label = (group: "modules" | "actions", key: string) => (t.has(`${group}.${key}`) ? t(`${group}.${key}`) : key);
  const changed = roles.filter((role) => edits[role.code]);
  const discard = (code: string) => setEdits(Object.fromEntries(Object.entries(edits).filter(([key]) => key !== code)));

  function toggle(role: RoleRow, key: string) {
    const next = new Set(current(role));
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const same = next.size === role.permissions.length && role.permissions.every((permission) => next.has(permission));
    if (same) discard(role.code);
    else setEdits({ ...edits, [role.code]: next });
  }

  return (
    <AdminPage title={t("title")} lead={t("intro")}>
      {matrix.error && <LoadError message={matrix.error} onRetry={matrix.reload} />}
      {!matrix.data && !matrix.error && <Notice kind="loading">{t("loading")}</Notice>}
      {changed.length > 0 && (
        <Notice kind="warning" title={t("unsaved")}>
          <ul className="mt-2 space-y-2">
            {changed.map((role) => (
              <li key={role.code} className="flex flex-wrap items-center gap-2">
                <span className="mr-auto font-medium">{roleName(role)}</span>
                <Button size="sm" variant="outline" onClick={() => discard(role.code)}>{t("discard")}</Button>
                <Button size="sm" onClick={() => setConfirm(role)}>{t("save")}</Button>
              </li>
            ))}
          </ul>
        </Notice>
      )}
      {matrix.data && (
        <div className="card max-h-[75dvh] overflow-auto" tabIndex={0} role="region" aria-label={t("title")}>
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">{t("title")}</caption>
            <thead>
              <tr>
                <th scope="col" className={`${cell} sticky left-0 top-0 z-20 min-w-48 bg-surface-muted text-left text-xs font-semibold text-muted-foreground`}>{t("permission")}</th>
                {roles.map((role) => (
                  <th key={role.code} scope="col" className={`${cell} sticky top-0 z-10 w-28 min-w-28 bg-surface-muted text-center align-bottom text-xs font-semibold`}>
                    {roleName(role)}
                    {edits[role.code] && <span className="block font-normal text-accent">{t("changed")}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map(([module, group]) => (
                <Fragment key={module}>
                  <tr>
                    <th scope="colgroup" colSpan={roles.length + 1} className={`${cell} sticky left-0 bg-surface pt-4 text-left font-bold`}>{label("modules", module)}</th>
                  </tr>
                  {group.map((permission) => (
                    <tr key={permission.key}>
                      <th scope="row" className={`${cell} sticky left-0 z-[5] bg-surface text-left font-normal`}>
                        {label("actions", permission.action)}
                        <code className="block font-mono text-xs text-muted-foreground">{permission.key}</code>
                      </th>
                      {roles.map((role) => {
                        const locked = role.code === "super_admin";
                        return (
                          <td key={role.code} className={`${cell} text-center`}>
                            {locked ? (
                              <Lock className="inline size-4 text-muted-foreground" aria-label={t("always")} />
                            ) : (
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                checked={current(role).has(permission.key)}
                                aria-label={t("cell", { permission: `${label("modules", module)}: ${label("actions", permission.action)}`, role: roleName(role) })}
                                onChange={() => toggle(role, permission.key)}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("superNote")}
      </p>
      {confirm && (
        <ConfirmDialog
          danger
          title={t("confirmTitle")}
          description={t("confirmDescription", { role: roleName(confirm) })}
          confirmLabel={t("confirm")}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await adminRequest(`/roles/${confirm.code}/permissions`, { method: "PUT", body: { permissions: [...(edits[confirm.code] ?? [])].sort() } });
            discard(confirm.code);
            toast.success(t("saved", { role: roleName(confirm) }));
            matrix.reload();
          }}
        />
      )}
    </AdminPage>
  );
}
