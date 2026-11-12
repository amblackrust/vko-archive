"use client";

import { createContext, Suspense, useContext, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import clsx from "clsx";
import { api, ApiError, type Schema } from "@/lib/api/client";
import { Link, usePathname } from "@/i18n/navigation";
import { MENU } from "@/lib/admin-config";
import { LogoMark } from "@/components/shell/logo";
import { LangSwitch } from "@/components/shell/lang-switch";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { IconButton } from "@/components/ui/icon-button";
import { Notifications } from "./notifications";
import { AdminLogin } from "./admin-login";

type Me = Schema["MeResponse"];
const Ctx = createContext<{ me: Me; can: (perm: string) => boolean } | null>(null);
export const useAdmin = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("outside admin shell");
  return v;
};

/** Staff area: a top bar with grouped menus and full-width pages. No side panel. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin");
  const qc = useQueryClient();
  const pathname = usePathname();
  const [bell, setBell] = useState(false);
  const meQ = useQuery({ queryKey: ["admin-me"], retry: false, staleTime: 60_000, queryFn: () => api.get<Me>("/api/admin/auth/me", { scope: "admin" }).catch((e) => (e instanceof ApiError && e.status === 401 ? null : Promise.reject(e))) });

  if (meQ.isLoading) return <div className="grid min-h-dvh place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-frame border-t-action" aria-busy /></div>;
  const me = meQ.data;
  if (!me) return <AdminLogin />;
  const can = (perm: string) => me.is_super || me.permissions.includes(perm);
  const logout = async () => {
    await api.post("/api/admin/auth/logout", { scope: "admin" }).catch(() => undefined);
    // Flip the session query first: clearing the whole cache would detach the observer that renders the login form.
    qc.setQueryData(["admin-me"], null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "admin-me" });
  };

  return (
    <Ctx.Provider value={{ me, can }}>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-40 border-b border-frame bg-paper">
          <div className="wrap flex h-[3.75rem] items-center gap-6">
            <Link href="/admin" className="flex shrink-0 items-center gap-2.5 no-underline"><LogoMark size={32} /><span className="font-display text-base font-bold tracking-[-0.02em] max-md:hidden">{t("title")}</span></Link>
            <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-visible max-lg:hidden" aria-label={t("title")}>
              {MENU.map((g) => {
                const items = g.items.filter((i) => can(i.perm));
                if (!items.length) return null;
                const open = items.some((i) => pathname.startsWith(i.href));
                return (
                  <div key={g.group} className="group relative">
                    <button type="button" className={clsx("inline-flex h-10 items-center gap-1 rounded-full px-4 font-semibold transition-colors hover:bg-mount-2", open && "bg-action-soft text-action")}>{t(`menu.${g.group}`)}<ChevronDown size={14} className="transition-transform group-hover:rotate-180 group-focus-within:rotate-180" aria-hidden /></button>
                    <ul className="invisible absolute left-0 top-full z-50 min-w-56 translate-y-1 rounded-2xl border border-frame bg-paper p-1.5 opacity-0 shadow-lift-high transition-[opacity,transform] duration-150 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                      {items.map((i) => <li key={i.key}><Link href={i.href} className={clsx("block rounded-xl px-3.5 py-2 no-underline hover:bg-mount-2", pathname.startsWith(i.href) && "font-semibold text-action")}>{t(`res.${i.key}`)}</Link></li>)}
                    </ul>
                  </div>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-1">
              <div className="relative">
                <IconButton label={t("notif.title")} onClick={() => setBell((v) => !v)} aria-expanded={bell}><Bell size={18} /></IconButton>
                {bell && <Notifications onClose={() => setBell(false)} />}
              </div>
              <Suspense><LangSwitch /></Suspense>
              <ThemeSwitch />
              <span className="mx-1 hidden text-sm text-ink-3 xl:block">{me.full_name}</span>
              <IconButton label={t("logout")} onClick={logout}><LogOut size={18} /></IconButton>
            </div>
          </div>
          <nav className="wrap flex gap-1 overflow-x-auto pb-2 lg:hidden" aria-label={t("title")}>
            {MENU.flatMap((g) => g.items).filter((i) => can(i.perm)).map((i) => <Link key={i.key} href={i.href} className={clsx("shrink-0 rounded-full px-3.5 py-1.5 text-sm no-underline", pathname.startsWith(i.href) ? "bg-action text-action-ink" : "bg-mount-2")}>{t(`res.${i.key}`)}</Link>)}
          </nav>
        </header>
        <main className="wrap py-8">{children}</main>
      </div>
    </Ctx.Provider>
  );
}
