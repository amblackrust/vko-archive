"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type Schema } from "@/lib/api/client";
import { LogoMark } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";

export function AdminLogin() {
  const t = useTranslations("admin.login");
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/auth/login", { body: { email, password }, scope: "admin" });
      qc.setQueryData(["admin-me"], await api.get<Schema["MeResponse"]>("/api/admin/auth/me", { scope: "admin" }));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t("locked") : t("bad"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="mb-8 flex items-center gap-3"><LogoMark size={44} /><h1 className="text-3xl">{t("title")}</h1></div>
        <label className="block"><span className="label">{t("email")}</span><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label className="block"><span className="label">{t("password")}</span><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required aria-invalid={!!error} /></label>
        {error && <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-bad">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{t("submit")}</Button>
      </form>
    </div>
  );
}
