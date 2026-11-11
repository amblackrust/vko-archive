"use client";

import { useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, ShieldBan, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ROLE_CODES, branchOptionsApi, can, pickName, usersApi, type AdminUser, type BranchOption } from "@/lib/api/admin";
import { formatDateTime } from "@/lib/dates";
import { useMe } from "../admin-provider";
import { Badge } from "../kit/badge";
import { DataTable, RowAction, type Column } from "../kit/data-table";
import { AdminDialog, ConfirmDialog } from "../kit/dialog";
import { Checkbox, FieldGroup, Select, SelectField, TextField } from "../kit/form";
import { useAction, useDebounced, useLoad } from "../kit/hooks";
import { EmptyState, NoAccess, Notice } from "../kit/notice";
import { AdminPage, SearchField, Toolbar } from "../kit/page";
import { useToast } from "../kit/toast";

const PAGE_SIZE = 20;

type Dialogs = { kind: "form"; user: AdminUser | null } | { kind: "password" | "toggle"; user: AdminUser } | null;

/** Пользователи: учётные записи сотрудников, роли, филиал, блокировка и сброс пароля. */
export function UsersView() {
  const t = useTranslations("admin.users");
  const locale = useLocale();
  const me = useMe();
  const toast = useToast();
  const allowed = can(me, "users.view");
  const canManage = can(me, "users.manage");
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialogs>(null);

  useEffect(() => setPage(1), [q, role, status]);
  const users = useLoad(
    () => (allowed ? usersApi.list({ q: q || undefined, role: role || undefined, is_active: status === "" ? undefined : status === "active", page, page_size: PAGE_SIZE }) : Promise.resolve(null)),
    [q, role, status, page],
  );
  const branches = useLoad(() => (allowed ? branchOptionsApi.list() : Promise.resolve([])), []);
  if (!allowed) return <NoAccess />;
  const branchName = (id: string | null) => {
    const branch = branches.data?.find((item) => item.id === id);
    return branch ? pickName(branch.name, locale) : t("wholeArchive");
  };

  const columns: Column<AdminUser>[] = [
    {
      key: "user",
      header: t("columns.user"),
      primary: true,
      className: "md:w-[28%]",
      cell: (row) => (
        <>
          <p className="break-words font-semibold">{row.full_name || row.email}</p>
          <p className="text-muted-foreground [overflow-wrap:anywhere]">{row.email}</p>
        </>
      ),
    },
    { key: "roles", header: t("columns.roles"), cell: (row) => row.roles.map((code) => t(`roles.${code}`)).join(", ") },
    { key: "branch", header: t("columns.branch"), cell: (row) => branchName(row.branch_id) },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) =>
        !row.is_active ? <Badge tone="danger">{t("status.blocked")}</Badge>
        : row.is_locked ? <Badge tone="warning">{t("status.locked")}</Badge>
        : <Badge tone="success">{t("status.active")}</Badge>,
    },
    {
      key: "lastLogin",
      header: t("columns.lastLogin"),
      className: "md:whitespace-nowrap",
      cell: (row) => <span className="tabular-nums text-muted-foreground">{row.last_login_at ? formatDateTime(row.last_login_at) : t("never")}</span>,
    },
  ];
  if (canManage) {
    columns.push({
      key: "actions",
      header: t("columns.actions"),
      actions: true,
      className: "md:w-px md:whitespace-nowrap",
      // Свою запись менять нельзя (запрещено и на сервере).
      cell: (row) =>
        row.id === me.id ? (
          <span className="text-muted-foreground">{t("itsYou")}</span>
        ) : (
          <div className="flex gap-0.5 max-md:-ml-2 md:justify-end">
            <RowAction label={t("actions.edit", { email: row.email })} onClick={() => setDialog({ kind: "form", user: row })}><Pencil /></RowAction>
            <RowAction label={t("actions.password", { email: row.email })} onClick={() => setDialog({ kind: "password", user: row })}><KeyRound /></RowAction>
            <RowAction danger={row.is_active} label={t(row.is_active ? "actions.block" : "actions.unblock", { email: row.email })} onClick={() => setDialog({ kind: "toggle", user: row })}>
              {row.is_active ? <ShieldBan /> : <ShieldCheck />}
            </RowAction>
          </div>
        ),
    });
  }

  function done(message: string) {
    setDialog(null);
    toast.success(message);
    users.reload();
  }
  const toggled = dialog?.kind === "toggle" ? dialog.user : null;

  return (
    <AdminPage title={t("title")} lead={t(canManage ? "lead" : "leadReadOnly")}>
      <Toolbar
        actions={
          canManage && (
            <Button onClick={() => setDialog({ kind: "form", user: null })}>
              <Plus aria-hidden />
              {t("create")}
            </Button>
          )
        }
      >
        <SearchField label={t("search")} value={search} onChange={setSearch} />
        <Select className="sm:w-56" aria-label={t("columns.roles")} value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="">{t("allRoles")}</option>
          {ROLE_CODES.map((code) => <option key={code} value={code}>{t(`roles.${code}`)}</option>)}
        </Select>
        <Select className="sm:w-44" aria-label={t("columns.status")} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t("allStatuses")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="blocked">{t("status.blocked")}</option>
        </Select>
      </Toolbar>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={users.data?.items ?? null}
        rowKey={(row) => row.id}
        loading={users.loading}
        error={users.error}
        onRetry={users.reload}
        empty={<EmptyState title={t("empty")}>{t("emptyHint")}</EmptyState>}
        pagination={users.data ? { page, pageSize: PAGE_SIZE, total: users.data.total, onPage: setPage } : undefined}
      />

      {dialog?.kind === "form" && <UserFormDialog user={dialog.user} branches={branches.data ?? []} canGrantSuper={me.is_super} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.kind === "password" && <ResetPasswordDialog user={dialog.user} onClose={() => setDialog(null)} onDone={done} />}
      {toggled && (
        <ConfirmDialog
          danger={toggled.is_active}
          title={t(toggled.is_active ? "blockTitle" : "unblockTitle")}
          description={t(toggled.is_active ? "blockDescription" : "unblockDescription", { email: toggled.email })}
          confirmLabel={t(toggled.is_active ? "block" : "unblock")}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await usersApi.update(toggled.id, { is_active: !toggled.is_active });
            toast.success(t(toggled.is_active ? "blocked" : "unblocked"));
            users.reload();
          }}
        />
      )}
    </AdminPage>
  );
}

function UserFormDialog({ user, branches, canGrantSuper, onClose, onSaved }: {
  /** null — создание нового пользователя. */
  user: AdminUser | null;
  branches: BranchOption[];
  /** Может ли текущий сотрудник назначать роль главного администратора. */
  canGrantSuper: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const action = useAction();
  const [email, setEmail] = useState(user?.email ?? "");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState(user?.branch_id ?? "");
  const [roles, setRoles] = useState<string[]>(user?.roles ?? []);
  const creating = user === null;
  const roleOptions = ROLE_CODES.filter((code) => canGrantSuper || code !== "super_admin" || roles.includes(code));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (roles.length === 0) return action.setError(t("errors.noRoles"));
    const saved = await action.run(async () => {
      if (creating) {
        await usersApi.create({ email, full_name: fullName, password, roles, branch_id: branchId || null });
      } else {
        // Раздельные запросы; сначала профиль, потом роли (если упал первый — роли не трогаем).
        const profile = await usersApi.update(user.id, { email, full_name: fullName, branch_id: branchId || null });
        const sameRoles = profile.roles.length === roles.length && roles.every((code) => profile.roles.includes(code));
        if (!sameRoles) await usersApi.setRoles(user.id, roles);
      }
    });
    if (saved) onSaved(creating ? t("created") : t("saved"));
  }

  return (
    <AdminDialog
      title={creating ? t("createTitle") : t("editTitle")}
      srDescription={t("formDescription")}
      busy={action.pending}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={action.pending}>{tc("cancel")}</Button>
          <Button type="submit" form="admin-user-form" disabled={action.pending}>{action.pending ? tc("saving") : tc("save")}</Button>
        </>
      }
    >
      <form id="admin-user-form" onSubmit={submit} className="space-y-4">
        {action.error && <Notice kind="error">{action.error}</Notice>}
        <TextField label={t("fields.email")} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField label={t("fields.fullName")} maxLength={255} value={fullName} onChange={(event) => setFullName(event.target.value)} />
        {creating && (
          <TextField label={t("fields.password")} hint={t("passwordHint")} type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} />
        )}
        <SelectField label={t("fields.branch")} hint={t("branchHint")} value={branchId} onChange={(event) => setBranchId(event.target.value)}>
          <option value="">{t("noBranch")}</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{pickName(branch.name, locale)}</option>)}
        </SelectField>
        <FieldGroup legend={t("fields.roles")} hint={t("rolesHint")}>
          {roleOptions.map((code) => (
            <Checkbox
              key={code}
              label={t(`roles.${code}`)}
              hint={t(`roleHints.${code}`)}
              checked={roles.includes(code)}
              onChange={() => setRoles((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]))}
            />
          ))}
        </FieldGroup>
      </form>
    </AdminDialog>
  );
}

function ResetPasswordDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: (message: string) => void }) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("admin.common");
  const action = useAction();
  const [password, setPassword] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (await action.run(() => usersApi.resetPassword(user.id, password))) onDone(t("passwordReset"));
  }

  return (
    <AdminDialog
      size="sm"
      title={t("resetTitle")}
      description={t("resetDescription", { email: user.email })}
      busy={action.pending}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={action.pending}>{tc("cancel")}</Button>
          <Button type="submit" form="admin-password-form" disabled={action.pending}>{action.pending ? tc("saving") : t("resetSubmit")}</Button>
        </>
      }
    >
      <form id="admin-password-form" onSubmit={submit} className="space-y-4">
        {action.error && <Notice kind="error">{action.error}</Notice>}
        <TextField label={t("fields.newPassword")} hint={t("passwordHint")} type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} />
      </form>
    </AdminDialog>
  );
}
