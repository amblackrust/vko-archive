"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CabinetError, cabinetFetch, type VisitorMe } from "./api";
import { errorKey } from "./errors";
import { PasswordResetRequest } from "./password-reset-request";

/** Вход и регистрация посетителя. Пароль не хранится на клиенте и не попадает в URL. */
export function AuthForms({ onSignedIn }: { onSignedIn: (me: VisitorMe) => void }) {
  const t = useTranslations("cabinet");
  const locale = useLocale();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [forgot, setForgot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const body = { email: String(data.get("email")), password: String(data.get("password")) };
      const me =
        mode === "login"
          ? await cabinetFetch<VisitorMe>("/auth/login", { method: "POST", body })
          : await cabinetFetch<VisitorMe>("/auth/register", { method: "POST", body: { ...body, display_name: String(data.get("name") ?? ""), lang: locale } });
      onSignedIn(me);
    } catch (e) {
      setError(errorKey(e instanceof CabinetError ? e.code : "generic"));
    } finally {
      setBusy(false);
    }
  }

  if (forgot) return <PasswordResetRequest onBack={() => setForgot(false)} />;

  const field = "h-10 rounded-md border bg-background px-3 font-normal";
  return (
    <section aria-labelledby="auth-title" className="max-w-md space-y-4 rounded-lg border bg-surface p-5">
      <div role="tablist" className="flex gap-2">
        {(["login", "register"] as const).map((value) => (
          <Button key={value} role="tab" aria-selected={mode === value} variant={mode === value ? "primary" : "outline"} size="sm"
            onClick={() => { setMode(value); setError(null); }}>
            {t(`auth.${value}`)}
          </Button>
        ))}
      </div>
      <h2 id="auth-title" className="sr-only">{t(`auth.${mode}`)}</h2>
      <form onSubmit={submit} className="space-y-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("auth.email")}
          <input name="email" type="email" required autoComplete="email" maxLength={320} className={field} />
        </label>
        {mode === "register" && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("auth.displayName")}
            <input name="name" autoComplete="nickname" maxLength={100} className={field} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("auth.password")}
          <input name="password" type="password" required minLength={mode === "register" ? 10 : 1} maxLength={256}
            autoComplete={mode === "login" ? "current-password" : "new-password"} className={field} />
          {mode === "register" && <span className="text-xs font-normal text-muted-foreground">{t("auth.passwordHint")}</span>}
        </label>
        {mode === "login" && (
          <Button type="button" variant="link" size="sm" className="justify-start px-0" onClick={() => setForgot(true)}>
            {t("auth.forgotPassword")}
          </Button>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
        <Button type="submit" disabled={busy}>{mode === "login" ? t("auth.submitLogin") : t("auth.submitRegister")}</Button>
      </form>
    </section>
  );
}
