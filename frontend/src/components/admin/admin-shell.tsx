"use client";

import { Suspense, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { useAdmin, useMe } from "./admin-provider";
import { visibleNav } from "./nav-config";
import { NotificationBell } from "./notification-bell";
import { Notice } from "./notice";
import { SessionGuard } from "./session-guard";
import { useApiError } from "./use-api-error";

/** Каркас админки: боковое меню по правам (на мобильном — выезжающее), верхняя панель, колокольчик, выход. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin");
  const describe = useApiError();
  const me = useMe();
  const { logout } = useAdmin();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const items = visibleNav(me);

  async function signOut() {
    try {
      await logout();
    } catch (caught) {
      setLogoutError(describe(caught));
    }
  }

  const nav = (
    <nav aria-label={t("shell.sections")} className="space-y-1 p-3">
      {items.map(({ key, href, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-muted",
              active && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t(`nav.${key}`)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <a
        href="#admin-main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("shell.skip")}
      </a>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 border-r bg-surface transition-transform md:static md:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <span className="font-serif text-lg font-semibold">{t("shell.brand")}</span>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("shell.closeMenu")} onClick={() => setMenuOpen(false)}>
            <X />
          </Button>
        </div>
        {nav}
      </aside>
      {menuOpen && <div className="fixed inset-0 z-20 bg-foreground/40 md:hidden" aria-hidden onClick={() => setMenuOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b bg-surface px-3 md:px-6">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("shell.openMenu")} onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block" title={me.email}>
              {me.full_name || me.email}
            </span>
            <Suspense>
              <LocaleSwitcher />
            </Suspense>
            <ThemeToggle />
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut aria-hidden />
              <span className="hidden sm:inline">{t("shell.logout")}</span>
              <span className="sr-only sm:hidden">{t("shell.logout")}</span>
            </Button>
          </div>
        </header>
        {logoutError && <Notice kind="error" className="m-3">{logoutError}</Notice>}
        <main id="admin-main" className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
      <SessionGuard />
    </div>
  );
}
