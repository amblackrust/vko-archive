"use client";

import { useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, ShieldBan, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ForbiddenState } from "@/components/ui/state-view";
import { Input } from "@/components/ui/input";
import { ROLE_CODES, branchOptionsApi, can, pickName, usersApi, type AdminUser } from "@/lib/api/admin";
import { ConfirmDialog } from "../confirm-dialog";
import { DataTable, type Column } from "../data-table";
import { Select } from "../form-field";
import { useMe } from "../admin-provider";
import { Notice } from "../notice";
import { Pagination } from "../pagination";
import { useLoad } from "../use-load";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { UserFormDialog } from "./user-form-dialog";

const PAGE_SIZE = 20;

type Dialogs =
  | { kind: "form"; user: AdminUser | null }
  | { kind: "password"; user: AdminUser }
  | { kind: "toggle"; user: AdminUser }
  | null;

function UsersContent() {
  const t = useTranslations("admin.users");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const me = useMe();
  const canManage = can(me, "users.manage");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Поиск применяется через 300 мс после ввода и сбрасывает страницу.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const users = useLoad(
    () => usersApi.list({ q: q || undefined, role: role || undefined, is_active: status === "" ? undefined : status === "active", page, page_size: PAGE_SIZE }),
    [q, role, status, page],
  );
  const branches = useLoad(() => branchOptionsApi.list(), []);
  const branchName = (id: string | null) => {
    const branch = branches.data?.find((item) => item.id === id);
    return branch ? pickName(branch.name, locale) : "—";
  };

  const columns: Column<AdminUser>[] = [
    {
      key: "user",
      header: t("columns.user"),
      cell: (row) => (
        <>
          <p className="font-medium">{row.full_name || "—"}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </>
      ),
    },
    { key: "roles", header: t("columns.roles"), cell: (row) => row.roles.map((code) => t(`roles.${code}`)).join(", ") },
    { key: "branch", header: t("columns.branch"), cell: (row) => branchName(row.branch_id) },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) =>
        row.is_active ? (
          <span>{row.is_locked ? t("status.locked") : t("status.active")}</span>
        ) : (
          <span className="font-medium text-destructive">{t("status.blocked")}</span>
        ),
    },
    {
      key: "lastLogin",
      header: t("columns.lastLogin"),
      cell: (row) => (row.last_login_at ? new Date(row.last_login_at).toLocaleString(locale) : t("never")),
    },
  ];
  if (canManage) {
    columns.push({
      key: "actions",
      header: tc("actions"),
      className: "whitespace-nowrap",
      // Свою запись менять нельзя (запрещено и на сервере).
      cell: (row) =>
        row.id === me.id ? (
          <span className="text-xs text-muted-foreground">{t("itsYou")}</span>
        ) : (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" aria-label={t("actions.edit", { email: row.email })} onClick={() => setDialog({ kind: "form", user: row })}>
              <Pencil />
            </Button>
            <Button size="icon" variant="ghost" aria-label={t("actions.password", { email: row.email })} onClick={() => setDialog({ kind: "password", user: row })}>
              <KeyRound />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t(row.is_active ? "actions.block" : "actions.unblock", { email: row.email })}
              onClick={() => setDialog({ kind: "toggle", user: row })}
            >
              {row.is_active ? <ShieldBan /> : <ShieldCheck />}
            </Button>
          </div>
        ),
    });
  }

  function done(message: string) {
    setDialog(null);
    setSuccess(message);
    users.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">{t("title")}</h1>
        {canManage && (
          <Button onClick={() => setDialog({ kind: "form", user: null })}>
            <Plus aria-hidden />
            {t("create")}
          </Button>
        )}
      </div>
      {success && <Notice kind="success">{success}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Input className="max-w-xs" type="search" aria-label={t("search")} placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select className="w-auto" aria-label={t("columns.roles")} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">{t("allRoles")}</option>
          {ROLE_CODES.map((code) => (
            <option key={code} value={code}>{t(`roles.${code}`)}</option>
          ))}
        </Select>
        <Select className="w-auto" aria-label={t("columns.status")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t("allStatuses")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="blocked">{t("status.blocked")}</option>
        </Select>
      </div>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={users.data?.items ?? null}
        rowKey={(row) => row.id}
        loading={users.loading}
        error={users.error}
        onRetry={users.reload}
        emptyText={t("empty")}
      />
      {users.data && <Pagination page={page} pageSize={PAGE_SIZE} total={users.data.total} onPage={setPage} />}

      {dialog?.kind === "form" && (
        <UserFormDialog
          user={dialog.user}
          branches={branches.data ?? []}
          canGrantSuper={me.is_super}
          onClose={() => setDialog(null)}
          onSaved={done}
        />
      )}
      {dialog?.kind === "password" && <ResetPasswordDialog user={dialog.user} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "toggle" && (
        <ConfirmDialog
          open
          danger={dialog.user.is_active}
          onOpenChange={(open) => !open && setDialog(null)}
          title={t(dialog.user.is_active ? "blockTitle" : "unblockTitle")}
          description={t(dialog.user.is_active ? "blockDescription" : "unblockDescription", { email: dialog.user.email })}
          confirmLabel={t(dialog.user.is_active ? "block" : "unblock")}
          onConfirm={async () => {
            await usersApi.update(dialog.user.id, { is_active: !dialog.user.is_active });
            done(t(dialog.user.is_active ? "blocked" : "unblocked"));
          }}
        />
      )}
    </div>
  );
}

/** Без права users.view раздел не загружает данные (сервер всё равно ответил бы 403). */
export function UsersView() {
  const me = useMe();
  return can(me, "users.view") ? <UsersContent /> : <ForbiddenState />;
}
