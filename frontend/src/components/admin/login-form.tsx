"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { LogoMark } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { AdminApiError } from "@/lib/api/admin";
import { Link } from "@/lib/i18n/navigation";
import { useAdmin } from "./admin-provider";
import { TextField } from "./kit/form";
import { Notice } from "./kit/notice";

const RULES = ["roles", "session", "lockout"] as const;

/** Вход сотрудника: слева — чей это сайт и правила доступа, справа — форма. */
export function LoginForm() {
  const t = useTranslations("admin.login");
  const site = useTranslations("layout");
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
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="on-brand flex flex-col justify-between gap-10 bg-brand! bg-none! px-6 py-8 sm:px-10 lg:py-12">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10 shrink-0" />
          <p className="text-[0.9375rem] font-bold leading-tight">{site("siteName")}</p>
        </div>
        <div className="max-w-md space-y-5 max-lg:hidden">
          <p className="text-3xl font-bold leading-tight">{t("brandTitle")}</p>
          <ul className="divide-y border-y text-sm text-muted-foreground">
            {RULES.map((rule) => <li key={rule} className="py-3">{t(`rules.${rule}`)}</li>)}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground max-lg:hidden">{t("subtitle")}</p>
      </aside>

      <main className="flex flex-col gap-6 px-4 py-6 sm:px-10">
        <div className="flex items-center justify-end gap-1">
          <Suspense>
            <LocaleSwitcher />
          </Suspense>
          <ThemeToggle />
        </div>
        <form onSubmit={submit} className="card m-auto w-full max-w-md space-y-5 p-6 sm:p-8">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
            <p className="text-sm text-muted-foreground lg:hidden">{t("subtitle")}</p>
            <p className="text-sm text-muted-foreground">{t("hint")}</p>
          </div>
          {expired && <Notice kind="info">{t("expired")}</Notice>}
          {error && <Notice kind="error">{error}</Notice>}
          <TextField label={t("email")} type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <TextField label={t("password")} type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("submitting") : t("submit")}
          </Button>
          <p className="text-sm">
            <Link href="/" className="text-link">{t("toSite")}</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
