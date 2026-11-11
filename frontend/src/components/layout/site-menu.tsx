"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Mail, Menu, Phone, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Suspense, useEffect, useState } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { localeLabels, routing } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { A11ySettings } from "./a11y-settings";
import { catalogHref, navGroups } from "./nav-config";
import { Segmented } from "./segmented";
import { SocialLinks } from "./social-links";

/** Выбор языка: ссылки на ту же страницу в другой локали, путь и параметры запроса сохраняются. */
function LanguageLinks() {
  const t = useTranslations("layout.language");
  const current = useLocale();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const href = query ? `${pathname}?${query}` : pathname;
  return (
    <nav aria-label={t("label")}>
      <p className="text-sm font-medium text-muted-foreground">{t("label")}</p>
      <ul className="mt-1.5 flex gap-1 rounded-xl bg-surface-muted p-1">
        {routing.locales.map((locale) => (
          <li key={locale} className="flex-1">
            <Link
              href={href}
              locale={locale}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === current ? "true" : undefined}
              className={cn(
                "flex min-h-10 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors",
                locale === current ? "bg-surface text-primary shadow-card" : "hover:text-primary",
              )}
            >
              {localeLabels[locale].name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Тема оформления; выбранный вариант показывается после монтирования, чтобы не расходиться с сервером. */
function ThemeChoice() {
  const t = useTranslations("layout.theme");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Segmented
      label={t("label")}
      options={(["light", "dark", "system"] as const).map((value) => ({ value, label: t(value) }))}
      value={mounted ? ((theme as "light" | "dark" | "system") ?? "system") : null}
      onChange={setTheme}
    />
  );
}

/**
 * Боковое меню сайта: язык, тема, версия для слабовидящих, все разделы и контакты.
 * Кнопка показывает текущий язык, чтобы было понятно, где он переключается.
 */
export function SiteMenu() {
  const t = useTranslations("layout");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label={t("menu.open")} className="flex h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors hover:border-primary hover:text-primary">
          <Menu className="size-5" aria-hidden />
          <span aria-hidden>{localeLabels[locale as keyof typeof localeLabels]?.short}</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1d2a52]/35 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-background duration-200 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-background px-5 py-4">
            <Dialog.Title className="text-lg font-bold">{t("menu.title")}</Dialog.Title>
            <Dialog.Close aria-label={t("menu.close")} className="flex size-10 items-center justify-center rounded-md hover:bg-surface-muted">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("menu.description")}</Dialog.Description>

          <div className="space-y-4 px-5 pb-8">
            <section className="card space-y-4 p-4">
              <Suspense fallback={null}><LanguageLinks /></Suspense>
              <ThemeChoice />
            </section>

            <nav aria-label={t("menu.main")} className="card divide-y px-4">
              <Link href={catalogHref} className="flex min-h-12 items-center font-semibold text-primary">{t("catalogButton")}</Link>
              {navGroups.map((group) => (
                <details key={group.id} className="group py-1" open={group.items.some((item) => pathname === item.href)}>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
                    {t(`nav.groups.${group.id}`)}
                    <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <ul className="pb-2">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <Link href={item.href} aria-current={pathname === item.href ? "page" : undefined} className="flex min-h-10 items-center rounded-md px-3 text-[0.9375rem] hover:bg-primary-soft hover:text-primary aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary">
                          {t(`nav.items.${item.id}`)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </nav>

            <details className="card group px-4 py-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
                {t("a11y.open")}
                <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="pb-4 pt-1"><A11ySettings /></div>
            </details>

            <section className="card space-y-2 p-4 text-[0.9375rem]">
              <h2 className="text-sm font-medium text-muted-foreground">{t("contactsBlock.title")}</h2>
              <a href="tel:+77232251322" className="flex min-h-10 items-center gap-3 font-semibold hover:text-primary"><Phone className="size-4 text-primary" aria-hidden />{t("contactsBlock.phoneValue")}</a>
              <a href={`mailto:${t("contactsBlock.emailValue")}`} className="flex min-h-10 items-center gap-3 font-semibold hover:text-primary"><Mail className="size-4 text-primary" aria-hidden />{t("contactsBlock.emailValue")}</a>
              <p className="text-sm text-muted-foreground">{t("contactsBlock.addressValue")}</p>
              <p className="text-sm text-muted-foreground">{t("hours.office")}</p>
              <SocialLinks className="-ml-2" />
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
