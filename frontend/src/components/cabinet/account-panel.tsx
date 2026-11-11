"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cabinetFetch, type VisitorMe } from "./api";
import { ResendEmail } from "./cabinet-app";
import { ConfirmDialog, errorCode, PasswordRules, TextInput } from "./form";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-3 px-5 py-6 sm:px-6 lg:grid-cols-[16rem_minmax(0,32rem)]">
      <h3 className="text-lg">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Учётная запись: адрес почты и его подтверждение, смена пароля, удаление кабинета со всеми данными. */
export function AccountPanel({ me, onDeleted }: { me: VisitorMe; onDeleted: () => void }) {
  const t = useTranslations("cabinet");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [result, setResult] = useState<{ ok: boolean; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      await cabinetFetch("/auth/password", { method: "POST", body: { current_password: current, new_password: next } });
      setCurrent("");
      setNext("");
      setResult({ ok: true, code: "" });
    } catch (caught) {
      setResult({ ok: false, code: errorCode(caught) });
    } finally {
      setBusy(false);
    }
  }

  const failed = result && !result.ok ? result.code : null;
  const currentError = failed === "invalid_credentials" ? t("password.wrongCurrent") : null;
  const nextError = failed && ["password_length", "password_too_weak", "password_unchanged"].includes(failed) ? t(`errors.${failed}`) : null;

  return (
    <section aria-labelledby="cabinet-account" className="space-y-5">
      <div className="max-w-3xl space-y-1">
        <h2 id="cabinet-account" className="text-2xl sm:text-3xl">{t("sections.account")}</h2>
        <p className="text-muted-foreground">{t("account.lead")}</p>
      </div>
      <div className="card divide-y">
        <Block title={t("email.title")}>
          <p className="break-all font-semibold">{me.email}</p>
          {me.email_confirmed ? (
            <p className="flex items-center gap-2.5 text-sm"><span className="size-2 shrink-0 rounded-full bg-success" aria-hidden />{t("email.confirmed")}</p>
          ) : (
            <>
              <p className="flex items-start gap-2.5 text-sm"><span className="mt-[0.45em] size-2 shrink-0 rounded-full bg-accent" aria-hidden />{t("email.unconfirmedText")}</p>
              <ResendEmail />
            </>
          )}
        </Block>

        <Block title={t("password.title")}>
          <form onSubmit={changePassword} className="space-y-4">
            <TextInput label={t("password.current")} type="password" autoComplete="current-password" required maxLength={256} value={current} error={currentError} onChange={(event) => setCurrent(event.target.value)} />
            <TextInput label={t("password.new")} type="password" autoComplete="new-password" required minLength={10} maxLength={256} value={next} error={nextError} hint={<PasswordRules value={next} />} onChange={(event) => setNext(event.target.value)} />
            <p className="text-sm text-muted-foreground">{t("password.note")}</p>
            {failed && !currentError && !nextError && <p role="alert" className="text-sm text-destructive">{t(`errors.${failed}`)}</p>}
            {result?.ok && <p role="status" className="flex items-center gap-2.5 text-sm"><span className="size-2 shrink-0 rounded-full bg-success" aria-hidden />{t("password.done")}</p>}
            <Button type="submit" disabled={busy}>{t("password.submit")}</Button>
          </form>
        </Block>

        <Block title={t("delete.title")}>
          <p className="text-sm text-muted-foreground">{t("delete.text")}</p>
          <Button variant="outline" className="border-destructive text-destructive hover:border-destructive hover:bg-destructive-soft hover:text-destructive" onClick={() => setDeleting(true)}>{t("delete.button")}</Button>
        </Block>
      </div>
      {deleting && (
        <ConfirmDialog
          title={t("delete.confirmTitle")}
          text={t("delete.confirmText")}
          confirmLabel={t("delete.confirm")}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await cabinetFetch("/me", { method: "DELETE" });
            onDeleted();
          }}
        />
      )}
    </section>
  );
}
