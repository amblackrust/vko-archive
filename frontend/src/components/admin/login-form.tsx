"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminApiError } from "@/lib/api/admin";
import { FormField } from "./form-field";
import { Notice } from "./notice";
import { useAdmin } from "./admin-provider";

export function LoginForm() {
  const t = useTranslations("admin.login");
  const { login, expired } = useAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email, password);
    } catch (caught) {
      // Один текст для любой причины отказа (неверный пароль, блокировка, отключённая учётка).
      setError(caught instanceof AdminApiError && caught.code === "network" ? t("networkError") : t("invalid"));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-lg border bg-surface p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-primary">
            <Landmark className="size-6" aria-hidden />
          </span>
          <h1 className="font-serif text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {expired && <Notice kind="info">{t("expired")}</Notice>}
        {error && <Notice kind="error">{error}</Notice>}
        <FormField label={t("email")} htmlFor="admin-email">
          <Input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label={t("password")} htmlFor="admin-password">
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("submitting") : t("submit")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t("hint")}</p>
      </form>
    </main>
  );
}
