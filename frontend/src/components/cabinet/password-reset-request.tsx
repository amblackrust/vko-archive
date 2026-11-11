"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CabinetError, cabinetFetch } from "./api";
import { errorKey } from "./errors";

/** Запрос ссылки для сброса пароля. Ответ одинаковый для любого адреса: письмо уходит только зарегистрированным. */
export function PasswordResetRequest({ onBack }: { onBack: () => void }) {
  const t = useTranslations("cabinet");
  const locale = useLocale();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    setBusy(true);
    setError(null);
    try {
      await cabinetFetch("/auth/password-reset/request", { method: "POST", body: { email, lang: locale } });
      setSent(true);
    } catch (e) {
      setError(errorKey(e instanceof CabinetError ? e.code : "generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="reset-request-title" className="max-w-md space-y-4 rounded-lg border bg-surface p-5">
      <h2 id="reset-request-title" className="text-lg font-semibold">{t("reset.requestTitle")}</h2>
      {sent ? (
        <p role="status" className="text-sm">{t("reset.requestSent")}</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("reset.requestHint")}</p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("auth.email")}
            <input name="email" type="email" required autoComplete="email" maxLength={320} className="h-10 rounded-md border bg-background px-3 font-normal" />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
          <Button type="submit" disabled={busy}>{t("reset.requestSubmit")}</Button>
        </form>
      )}
      <Button type="button" variant="link" size="sm" className="px-0" onClick={onBack}>{t("reset.back")}</Button>
    </section>
  );
}
