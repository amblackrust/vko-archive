"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { cabinetFetch } from "./api";
import { errorCode, PasswordRules, StatusNote, TextInput } from "./form";

/** Новый пароль по одноразовой ссылке из письма. Пароль не попадает в URL и не хранится на клиенте. */
export function PasswordResetConfirm({ token }: { token: string }) {
  const t = useTranslations("cabinet");
  const [status, setStatus] = useState<"form" | "done" | "invalid">(token ? "form" : "invalid");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = repeat !== "" && repeat !== password;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== repeat) return;
    setBusy(true);
    setError(null);
    try {
      await cabinetFetch("/auth/password-reset/confirm", { method: "POST", body: { token, new_password: password } });
      setStatus("done");
    } catch (caught) {
      const code = errorCode(caught);
      if (code === "invalid_token") setStatus("invalid");
      else setError(code);
    } finally {
      setBusy(false);
    }
  }

  if (status !== "form") {
    return (
      <div className="max-w-xl space-y-5">
        {status === "done" ? <StatusNote tone="success" title={t("reset.done")}>{t("reset.doneText")}</StatusNote> : <StatusNote tone="warning" title={t("reset.invalidLink")}>{t("reset.invalidText")}</StatusNote>}
        <Button asChild variant={status === "done" ? "primary" : "outline"}>
          <Link href="/cabinet">{t(status === "done" ? "reset.signIn" : "reset.requestAgain")}</Link>
        </Button>
      </div>
    );
  }

  const passwordError = error && ["password_length", "password_too_weak"].includes(error) ? t(`errors.${error}`) : null;
  return (
    <form onSubmit={submit} className="card max-w-md space-y-4 p-6 sm:p-8">
      {error && !passwordError && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm">{t(`errors.${error}`)}</p>}
      <TextInput label={t("password.new")} name="password" type="password" required minLength={10} maxLength={256} autoComplete="new-password" value={password} error={passwordError} hint={<PasswordRules value={password} />} onChange={(event) => setPassword(event.target.value)} />
      <TextInput label={t("reset.repeat")} name="repeat" type="password" required maxLength={256} autoComplete="new-password" value={repeat} error={mismatch ? t("reset.mismatch") : null} onChange={(event) => setRepeat(event.target.value)} />
      <Button type="submit" size="lg" disabled={busy || mismatch}>{t("reset.confirmSubmit")}</Button>
    </form>
  );
}
