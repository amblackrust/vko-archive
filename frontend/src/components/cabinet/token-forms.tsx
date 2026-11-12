"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Request a password reset link, or set a new password from the link. */
export function ResetPassword({ token }: { token?: string }) {
  const t = useTranslations("cabinet");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (token) await api.post("/api/cabinet/auth/password-reset/confirm", { body: { token, new_password: password }, scope: "visitor" });
      else await api.post("/api/cabinet/auth/password-reset/request", { body: { email, lang: locale }, scope: "visitor" });
      setState("done");
    } catch (err) {
      setState(err instanceof ApiError ? "error" : "error");
    }
  };
  if (state === "done") return <div className="max-w-md"><p className="rounded-2xl bg-ok-soft px-5 py-4 text-ok">{token ? t("reset.done") : t("reset.sent")}</p>{token && <Link href="/cabinet" className="mt-4 inline-block text-action">{t("login")}</Link>}</div>;
  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      {token ? (
        <label className="block"><span className="label">{t("account.new")}</span><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} /><span className="mt-1 block text-sm text-ink-3">{t("passwordHint")}</span></label>
      ) : (
        <label className="block"><span className="label">{t("email")}</span><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
      )}
      {state === "error" && <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-bad">{t("errors.generic")}</p>}
      <Button type="submit" size="lg">{token ? t("reset.save") : t("reset.send")}</Button>
    </form>
  );
}

export function ConfirmEmail({ token }: { token?: string }) {
  const t = useTranslations("cabinet.confirmEmail");
  const [state, setState] = useState<"wait" | "ok" | "bad">("wait");
  useEffect(() => {
    if (!token) return setState("bad");
    api.post("/api/cabinet/auth/email/confirm", { body: { token }, scope: "visitor" }).then(() => setState("ok")).catch(() => setState("bad"));
  }, [token]);
  return state === "wait" ? <div className="h-8 w-48 animate-pulse rounded bg-mount-2" aria-busy /> : <p className={state === "ok" ? "text-xl text-ok" : "text-xl text-bad"}>{t(state)}</p>;
}
