"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ForbiddenState } from "@/components/ui/state-view";
import { adminRequest, pickName } from "@/lib/api/admin";
import { useMe } from "../admin-provider";
import { ConfirmDialog } from "../confirm-dialog";
import { Notice } from "../notice";
import { useApiError } from "../use-api-error";
import { useLoad } from "../use-load";

interface RoleRow {
  id: string;
  code: string;
  name: Record<string, string>;
  is_system: boolean;
  permissions: string[];
}
interface Matrix {
  roles: RoleRow[];
  permissions: { key: string; module: string; action: string }[];
}

function RolesContent() {
  const t = useTranslations("adminContent.roles");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const describe = useApiError();
  const matrix = useLoad(() => adminRequest<Matrix>("/roles"), []);
  // Правки по ролям: code → выбранный набор прав (пока не сохранён).
  const [edits, setEdits] = useState<Record<string, Set<string>>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const [state, setState] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  if (matrix.error) return <Notice kind="error" action={<Button size="sm" variant="outline" onClick={matrix.reload}>{tc("retry")}</Button>}>{matrix.error}</Notice>;
  if (!matrix.data) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  const { roles, permissions } = matrix.data;
  const current = (role: RoleRow) => edits[role.code] ?? new Set(role.permissions);

  function toggle(role: RoleRow, key: string) {
    const next = new Set(current(role));
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setEdits({ ...edits, [role.code]: next });
    setState(null);
  }

  async function save(code: string) {
    try {
      await adminRequest(`/roles/${code}/permissions`, { method: "PUT", body: { permissions: [...(edits[code] ?? [])].sort() } });
      const { [code]: _saved, ...rest } = edits;
      void _saved;
      setEdits(rest);
      setState({ kind: "success", text: t("saved") });
      matrix.reload();
    } catch (caught) {
      setState({ kind: "error", text: describe(caught) });
    }
  }

  const confirmRole = roles.find((role) => role.code === confirm);
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold">{t("title")}</h1>
      <p className="max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
      {state && <Notice kind={state.kind}>{state.text}</Notice>}
      <div className="overflow-x-auto rounded-lg border bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("title")}</caption>
          <thead>
            <tr className="border-b bg-surface-muted text-left">
              <th scope="col" className="p-2">{t("permission")}</th>
              {roles.map((role) => (
                <th key={role.code} scope="col" className="p-2 text-center font-medium">{pickName(role.name, locale)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.key} className="border-b last:border-0">
                <th scope="row" className="p-2 text-left font-normal"><code className="text-xs">{permission.key}</code></th>
                {roles.map((role) => {
                  const locked = role.code === "super_admin";
                  return (
                    <td key={role.code} className="p-2 text-center">
                      <input
                        type="checkbox"
                        className="size-4"
                        disabled={locked}
                        checked={locked || current(role).has(permission.key)}
                        aria-label={t("cell", { permission: permission.key, role: pickName(role.name, locale) })}
                        onChange={() => toggle(role, permission.key)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="p-2 text-xs text-muted-foreground"><Lock className="mr-1 inline size-3" aria-hidden />{t("superNote")}</td>
              {roles.map((role) => (
                <td key={role.code} className="p-2 text-center">
                  {role.code !== "super_admin" && (
                    <Button size="sm" disabled={!edits[role.code]} onClick={() => setConfirm(role.code)}>{tc("save")}</Button>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {confirmRole && (
        <ConfirmDialog
          open
          danger
          onOpenChange={(open) => !open && setConfirm(null)}
          title={t("confirmTitle")}
          description={t("confirmDescription", { role: pickName(confirmRole.name, locale) })}
          confirmLabel={t("confirm")}
          onConfirm={() => save(confirmRole.code)}
        />
      )}
    </div>
  );
}

/** Матрица ролей и прав (T6.2). Меняет только главный администратор: интерфейс скрыт для остальных, сервер проверяет `roles.manage`. */
export function RolesView() {
  const me = useMe();
  return me.is_super ? <RolesContent /> : <ForbiddenState />;
}
