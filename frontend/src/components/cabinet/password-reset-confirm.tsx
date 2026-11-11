"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { CabinetError, cabinetFetch } from "./api";
import { errorKey } from "./errors";

/** Новый пароль по одноразовой ссылке из письма. Пароль не попадает в URL и не хранится на клиенте. */
export function PasswordResetConfirm({ token }: { token: string }) {
  const t = useTranslations("cabinet");
  const [status, setStatus] = useState<"form" | "done" | "invalid">(token ? "form" : "invalid");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== String(data.get("repeat"))) {
      setError(t("reset.mismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await cabinetFetch("/auth/password-reset/confirm", { method: "POST", body: { token, new_password: password } });
      setStatus("done");
    } catch (e) {
      const code = e instanceof CabinetError ? e.code : "generic";
      if (code === "invalid_token") setStatus("invalid");
      else setError(t(errorKey(code)));
    } finally {
      setBusy(false);
    }
  }

  if (status === "invalid") {
    return (
      <section className="max-w-md space-y-4">
        <p role="alert" className="text-destructive">{t("reset.invalidLink")}</p>
        <Link href="/cabinet" className="text-primary underline-offset-4 hover:underline">{t("reset.requestAgain")}</Link>
      </section>
    );
  }

  if (status === "done") {
    return (
      <section className="max-w-md space-y-4">
        <p role="status">{t("reset.done")}</p>
        <Button asChild>
          <Link href="/cabinet">{t("reset.signIn")}</Link>
        </Button>
      </section>
    );
  }

  const field = "h-10 rounded-md border bg-background px-3 font-normal";
  return (
    <form onSubmit={submit} className="max-w-md space-y-3 rounded-lg border bg-surface p-5">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("reset.confirmTitle")}
        <input name="password" type="password" required minLength={10} maxLength={256} autoComplete="new-password" className={field} />
        <span className="text-xs font-normal text-muted-foreground">{t("auth.passwordHint")}</span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("reset.repeat")}
        <input name="repeat" type="password" required minLength={10} maxLength={256} autoComplete="new-password" className={field} />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{t("reset.confirmSubmit")}</Button>
    </form>
  );
}
