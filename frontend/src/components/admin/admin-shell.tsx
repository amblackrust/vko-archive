"use client";

import { Suspense, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, Check, ChevronDown, Globe, LogOut, Menu as Menu2, Moon, Sun, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { LogoMark } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { localeLabels, routing } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { useAdmin, useMe } from "./admin-provider";
import { Menu, menuItem } from "./kit/menu";
import { useToast } from "./kit/toast";
import { useApiError } from "./kit/use-api-error";
import { navItemFor, visibleNav } from "./nav-config";
import { NotificationBell } from "./notification-bell";
import { SessionGuard } from "./session-guard";

function Brand() {
  const t = useTranslations("admin.shell");
  const site = useTranslations("layout");
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-3">
      <LogoMark className="size-8 shrink-0" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-bold">{site("siteShort")}</span>
        <span className="block truncate text-xs text-muted-foreground">{t("brand")}</span>
      </span>
    </Link>
  );
}

/** Меню разделов, сгруппированное по задачам; состав определяют права сотрудника. */
function SectionNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("admin");
  const me = useMe();
  const pathname = usePathname();
  const current = navItemFor(pathname);
  return (
    <nav aria-label={t("shell.sections")} className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {visibleNav(me).map(({ group, items }) => (
        <div key={group ?? "top"} role="group" aria-labelledby={group ? `admin-nav-${group}` : undefined}>
          {group && <p id={`admin-nav-${group}`} className="px-3 pb-1.5 text-xs font-semibold text-muted-foreground">{t(`nav.groups.${group}`)}</p>}
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = item === current;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex min-h-10 items-center gap-2.5 rounded-md px-3 text-[0.9375rem] font-medium transition-colors hover:bg-surface-muted",
                      active && "bg-white font-semibold text-[#2536b0] hover:bg-white",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {t(`nav.${item.key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SiteLink({ className }: { className?: string }) {
  const t = useTranslations("admin.shell");
  return (
    <Link href="/" target="_blank" className={cn("inline-flex min-h-10 items-center gap-1 rounded-md px-2.5 text-sm font-medium transition-colors hover:bg-surface-muted hover:text-primary", className)}>
      {t("toSite")}
      <ArrowUpRight className="size-4" aria-hidden />
      <span className="sr-only">({t("newTab")})</span>
    </Link>
  );
}

/** Язык интерфейса: список с полными названиями; путь и параметры запроса сохраняются. */
function LanguageMenu() {
  const t = useTranslations("admin.shell");
  const current = useLocale() as keyof typeof localeLabels;
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const href = query ? `${pathname}?${query}` : pathname;
  return (
    <Menu
      label={t("language")}
      trigger={
        <>
          <Globe className="size-4 text-muted-foreground" aria-hidden />
          <span className="max-sm:hidden">{localeLabels[current].name}</span>
          <span className="sm:hidden">{localeLabels[current].short}</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </>
      }
    >
      <p className="px-3 pb-1 pt-1.5 text-xs font-semibold text-muted-foreground">{t("language")}</p>
      {routing.locales.map((locale) => (
        <Link key={locale} href={href} locale={locale} hrefLang={locale} lang={locale} aria-current={locale === current ? "true" : undefined} className={cn(menuItem, locale === current && "bg-primary-soft text-primary hover:bg-primary-soft")}>
          <span className="flex-1">{localeLabels[locale].name}</span>
          {locale === current ? <Check className="size-4" aria-hidden /> : <span className="text-xs text-muted-foreground">{localeLabels[locale].short}</span>}
        </Link>
      ))}
    </Menu>
  );
}

/** Учётная запись: кто вошёл, тема оформления и выход. */
function AccountMenu({ roles, onSignOut }: { roles: string; onSignOut: () => void }) {
  const t = useTranslations("admin.shell");
  const theme = useTranslations("layout.theme");
  const me = useMe();
  const { resolvedTheme, setTheme } = useTheme();
  const name = me.full_name || me.email;
  return (
    <Menu
      label={t("account")}
      className="pl-1.5"
      trigger={
        <>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
          <span className="hidden min-w-0 max-w-48 text-left leading-tight md:block">
            <span className="block truncate font-semibold">{name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{roles === name ? me.email : roles}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </>
      }
    >
      <div className="border-b px-3 pb-2.5 pt-1.5">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{me.email}</p>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-xs font-semibold text-muted-foreground">{t("theme")}</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-md bg-surface-muted p-1">
          {(["light", "dark"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={resolvedTheme === value} onClick={() => setTheme(value)} className={cn("flex min-h-9 items-center justify-center gap-1.5 rounded-sm text-sm font-medium", resolvedTheme === value && "bg-surface shadow-card")}>
              {value === "light" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
              {theme(value)}
            </button>
          ))}
        </div>
      </div>
      <div className="border-t pt-1.5">
        <SiteLink className="flex w-full justify-start px-3 text-[0.9375rem] md:hidden" />
        <button type="button" data-close onClick={onSignOut} className={cn(menuItem, "text-destructive")}>
          <LogOut className="size-4" aria-hidden />
          {t("logout")}
        </button>
      </div>
    </Menu>
  );
}

/** Каркас админки: меню слева (на телефоне — выдвижная панель), верхняя панель с разделом, сотрудником и выходом. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin");
  const describe = useApiError();
  const toast = useToast();
  const me = useMe();
  const { logout } = useAdmin();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const section = navItemFor(pathname);
  const roles = me.roles.map((code) => (t.has(`users.roles.${code}`) ? t(`users.roles.${code}`) : code)).join(", ");

  // Переход в другой раздел закрывает выдвижное меню.
  useEffect(() => setDrawer(false), [pathname]);

  async function signOut() {
    try {
      await logout();
    } catch (caught) {
      toast.error(describe(caught));
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a href="#admin-main" className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        {t("shell.skip")}
      </a>

      <aside className="on-brand hidden lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex h-16 shrink-0 items-center px-5">
            <Brand />
          </div>
          <SectionNav />
        </div>
      </aside>

      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/50 animate-in fade-in duration-200 lg:hidden" />
          <Dialog.Content className="on-brand fixed inset-y-0 left-0 z-40 flex w-[min(19rem,calc(100%-3rem))] flex-col animate-in slide-in-from-left duration-200 lg:hidden">
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
              <Dialog.Title asChild>
                <div className="min-w-0"><Brand /></div>
              </Dialog.Title>
              <Dialog.Description className="sr-only">{t("shell.sections")}</Dialog.Description>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label={t("shell.closeMenu")}>
                  <X />
                </Button>
              </Dialog.Close>
            </div>
            <SectionNav onNavigate={() => setDrawer(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-1 bg-surface px-2 shadow-card sm:px-4 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("shell.openMenu")} onClick={() => setDrawer(true)}>
            <Menu2 />
          </Button>
          <p className="min-w-0 flex-1 truncate text-lg font-bold">{t(`nav.${section.key}`)}</p>
          <SiteLink className="max-md:hidden" />
          <Suspense>
            <LanguageMenu />
          </Suspense>
          <NotificationBell />
          <AccountMenu roles={roles} onSignOut={signOut} />
        </header>
        <main id="admin-main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <Suspense>{children}</Suspense>
        </main>
      </div>
      <SessionGuard />
    </div>
  );
}
