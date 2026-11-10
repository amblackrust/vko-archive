"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_CODES, pickName, usersApi, type AdminUser, type BranchOption } from "@/lib/api/admin";
import { FormField, Select } from "../form-field";
import { Notice } from "../notice";
import { useApiError } from "../use-api-error";

interface UserFormDialogProps {
  /** null — создание нового пользователя. */
  user: AdminUser | null;
  branches: BranchOption[];
  /** Может ли текущий пользователь назначать роль super_admin. */
  canGrantSuper: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function UserFormDialog({ user, branches, canGrantSuper, onClose, onSaved }: UserFormDialogProps) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const describe = useApiError();
  const [email, setEmail] = useState(user?.email ?? "");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState(user?.branch_id ?? "");
  const [roles, setRoles] = useState<string[]>(user?.roles ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creating = user === null;
  const roleOptions = ROLE_CODES.filter((code) => canGrantSuper || code !== "super_admin" || roles.includes(code));

  function toggleRole(code: string) {
    setRoles((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (roles.length === 0) return setError(t("errors.noRoles"));
    setPending(true);
    setError(null);
    try {
      if (creating) {
        await usersApi.create({ email, full_name: fullName, password, roles, branch_id: branchId || null });
      } else {
        // Раздельные запросы; сначала профиль, потом роли (если уже упал первый — роли не трогаем).
        const profile = await usersApi.update(user.id, { email, full_name: fullName, branch_id: branchId || null });
        const sameRoles = profile.roles.length === roles.length && roles.every((role) => profile.roles.includes(role));
        if (!sameRoles) await usersApi.setRoles(user.id, roles);
      }
      onSaved(creating ? t("created") : t("saved"));
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !pending && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-surface p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">{creating ? t("createTitle") : t("editTitle")}</Dialog.Title>
          <Dialog.Description className="sr-only">{t("formDescription")}</Dialog.Description>
          <form onSubmit={submit} className="mt-4 space-y-4">
            {error && <Notice kind="error">{error}</Notice>}
            <FormField label={t("fields.email")} htmlFor="user-email">
              <Input id="user-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <FormField label={t("fields.fullName")} htmlFor="user-name">
              <Input id="user-name" value={fullName} maxLength={255} onChange={(e) => setFullName(e.target.value)} />
            </FormField>
            {creating && (
              <FormField label={t("fields.password")} htmlFor="user-password" hint={t("passwordHint")}>
                <Input id="user-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </FormField>
            )}
            <FormField label={t("fields.branch")} htmlFor="user-branch" hint={t("branchHint")}>
              <Select id="user-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">{t("noBranch")}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {pickName(branch.name, locale)}
                  </option>
                ))}
              </Select>
            </FormField>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("fields.roles")}</legend>
              {roleOptions.map((code) => (
                <label key={code} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" checked={roles.includes(code)} onChange={() => toggleRole(code)} />
                  {t(`roles.${code}`)}
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? tc("saving") : tc("save")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
