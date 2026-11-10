"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usersApi, type AdminUser } from "@/lib/api/admin";
import { FormField } from "../form-field";
import { Notice } from "../notice";
import { useApiError } from "../use-api-error";

export function ResetPasswordDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: (message: string) => void }) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("admin.common");
  const describe = useApiError();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await usersApi.resetPassword(user.id, password);
      onDone(t("passwordReset"));
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-surface p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">{t("resetTitle")}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">{t("resetDescription", { email: user.email })}</Dialog.Description>
          <form onSubmit={submit} className="mt-4 space-y-4">
            {error && <Notice kind="error">{error}</Notice>}
            <FormField label={t("fields.newPassword")} htmlFor="reset-password" hint={t("passwordHint")}>
              <Input id="reset-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? tc("saving") : t("resetSubmit")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
