"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cabinetFetch, type VisitorMe } from "./api";
import { errorCode, PasswordRules, StatusNote, TextInput } from "./form";

type Mode = "login" | "register" | "reset";
const EMAIL_ERRORS = ["email_taken", "invalid_email"];
const PASSWORD_ERRORS = ["password_length", "password_too_weak"];
const linkButton = "text-link text-sm font-medium";

/**
 * Вход, регистрация и запрос ссылки для нового пароля — одна форма с тремя режимами.
 * Пароль не хранится на клиенте и не попадает в URL; ошибка показывается у поля, к которому относится.
 */
export function AuthForm({ onSignedIn }: { onSignedIn: (me: VisitorMe) => void }) {
  const t = useTranslations("cabinet");
  const locale = useLocale();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setSent(false);
    setPassword("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "reset") {
        await cabinetFetch("/auth/password-reset/request", { method: "POST", body: { email, lang: locale } });
        setSent(true);
      } else if (mode === "login") {
        onSignedIn(await cabinetFetch<VisitorMe>("/auth/login", { method: "POST", body: { email, password } }));
      } else {
        onSignedIn(await cabinetFetch<VisitorMe>("/auth/register", { method: "POST", body: { email, password, display_name: name, lang: locale } }));
      }
    } catch (caught) {
      setError(errorCode(caught));
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (codes: string[]) => (error && codes.includes(error) ? t(`errors.${error}`) : null);
  const formError = error && ![...EMAIL_ERRORS, ...PASSWORD_ERRORS].includes(error) ? t(`errors.${error}`) : null;

  return (
    <section aria-labelledby="cabinet-auth-title" className="card h-full space-y-5 p-6 sm:p-8">
      <div className="space-y-1">
        <h2 id="cabinet-auth-title" className="text-2xl">{t(`auth.title.${mode}`)}</h2>
        <p className="text-muted-foreground">{t(`auth.lead.${mode}`)}</p>
      </div>

      {sent ? (
        <StatusNote tone="success" className="bg-surface-muted shadow-none">{t("reset.requestSent")}</StatusNote>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {formError && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm">{formError}</p>}
          <TextInput label={t("auth.email")} name="email" type="email" required autoComplete="email" maxLength={320} value={email} error={fieldError(EMAIL_ERRORS)} onChange={(event) => setEmail(event.target.value)} />
          {mode === "register" && (
            <TextInput label={t("auth.displayName")} hint={t("auth.displayNameHint")} name="name" autoComplete="nickname" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
          )}
          {mode !== "reset" && (
            <TextInput
              label={t("auth.password")}
              name="password"
              type="password"
              required
              minLength={mode === "register" ? 10 : 1}
              maxLength={256}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              error={fieldError(PASSWORD_ERRORS)}
              hint={mode === "register" ? <PasswordRules value={password} /> : undefined}
              aside={mode === "login" ? <button type="button" className={linkButton} onClick={() => switchTo("reset")}>{t("auth.forgotPassword")}</button> : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy}>{busy ? t("auth.working") : t(`auth.submit.${mode}`)}</Button>
        </form>
      )}

      <p className="border-t pt-4 text-sm">
        {mode === "login" ? (
          <>
            {t("auth.noAccount")} <button type="button" className={linkButton} onClick={() => switchTo("register")}>{t("auth.toRegister")}</button>
          </>
        ) : (
          <>
            {mode === "register" ? t("auth.hasAccount") : t("auth.remembered")} <button type="button" className={linkButton} onClick={() => switchTo("login")}>{t("auth.toLogin")}</button>
          </>
        )}
      </p>
    </section>
  );
}
