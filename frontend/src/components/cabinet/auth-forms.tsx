"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError, type Schema } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { GoogleButton } from "./google-button";
import { Link } from "@/i18n/navigation";

export function AuthForms() {
  const t = useTranslations("cabinet");
  const locale = useLocale() as "kk" | "ru" | "en";
  const qc = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onGoogle = (me: Schema["VisitorMe"]) => qc.setQueryData(["visitor"], me);
  const onGoogleError = (s: number) => setError(s === 401 ? t("errors.credentials") : t("errors.generic"));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = mode === "login"
        ? await api.post<Schema["VisitorMe"]>("/api/cabinet/auth/login", { body: { email, password }, scope: "visitor" })
        : await api.post<Schema["VisitorMe"]>("/api/cabinet/auth/register", { body: { email, password, display_name: name, lang: locale }, scope: "visitor" });
      qc.setQueryData(["visitor"], me);
    } catch (err) {
      const s = err instanceof ApiError ? err.status : 0;
      setError(s === 401 ? t("errors.credentials") : s === 429 ? t("errors.locked") : s === 422 ? t("errors.weak") : t("errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div role="tablist" className="mb-8 grid grid-cols-2 rounded-full bg-mount-2 p-1">
        {(["login", "register"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }} className={clsx("h-11 rounded-full font-semibold transition-[background-color,color,box-shadow]", mode === m ? "bg-paper shadow-lift" : "text-ink-3 hover:text-ink")}>{t(m)}</button>
        ))}
      </div>
      <GoogleButton onSession={onGoogle} onError={onGoogleError} />
      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && <label className="block"><span className="label">{t("name")}</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} /></label>}
        <label className="block"><span className="label">{t("email")}</span><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label className="block"><span className="label">{t("password")}</span><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1} aria-invalid={!!error} />{mode === "register" && <span className="mt-1 block text-sm text-ink-3">{t("passwordHint")}</span>}</label>
        {error && <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-bad">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{mode === "login" ? t("login") : t("createAccount")}</Button>
      </form>
      {mode === "login" && <p className="mt-5 text-center"><Link href="/cabinet/reset-password" className="text-action">{t("forgot")}</Link></p>}
    </div>
  );
}
