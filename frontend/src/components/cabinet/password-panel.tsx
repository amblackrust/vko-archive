"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cabinetFetch, CabinetError } from "./api";
import { errorKey } from "./errors";

/** Смена пароля: текущий + новый. Остальные сессии посетителя после смены выходят. */
export function PasswordPanel() {
  const t = useTranslations("cabinet");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await cabinetFetch("/auth/password", { method: "POST", body: { current_password: current, new_password: next } });
      setCurrent("");
      setNext("");
      setMessage({ kind: "ok", text: t("password.done") });
    } catch (error) {
      const code = error instanceof CabinetError ? error.code : "generic";
      const key = code === "invalid_credentials" ? "password.wrongCurrent" : code === "password_unchanged" ? "password.unchanged" : errorKey(code);
      setMessage({ kind: "error", text: t(key) });
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1 block w-full rounded-md border bg-background px-3 py-2";
  return (
    <section aria-labelledby="password-title" className="space-y-3">
      <h2 id="password-title" className="text-xl font-semibold">{t("password.title")}</h2>
      <form onSubmit={submit} className="max-w-sm space-y-3">
        <label className="block text-sm">
          {t("password.current")}
          <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm">
          {t("password.new")}
          <input type="password" autoComplete="new-password" required minLength={10} value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
          <span className="text-muted-foreground">{t("auth.passwordHint")}</span>
        </label>
        <p className="text-sm text-muted-foreground">{t("password.note")}</p>
        {message && (
          <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm text-destructive" : "text-sm"}>
            {message.text}
          </p>
        )}
        <Button type="submit" disabled={busy}>{t("password.submit")}</Button>
      </form>
    </section>
  );
}
