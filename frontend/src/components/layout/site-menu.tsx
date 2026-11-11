"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { A11ySettings } from "./a11y-settings";
import { catalogHref, navGroups } from "./nav-config";
import { ThemeChoice } from "./view-settings";

const summary = "flex min-h-12 cursor-pointer list-none items-center justify-between text-lg font-semibold [&::-webkit-details-marker]:hidden";

/**
 * Меню разделов для телефона и планшета (на широком экране разделы видны в шапке, и этой кнопки нет):
 * простой список на весь экран, внизу — оформление и версия для слабовидящих.
 */
export function SiteMenu() {
  const t = useTranslations("layout");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label={t("menu.open")} className="flex size-11 items-center justify-center rounded-md transition-colors hover:bg-surface-muted lg:hidden">
          <Menu className="size-6" aria-hidden />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-surface duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:hidden">
          <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between bg-surface px-4">
            <Dialog.Title className="text-lg font-bold">{t("menu.title")}</Dialog.Title>
            <Dialog.Close aria-label={t("menu.close")} className="flex size-11 items-center justify-center rounded-md hover:bg-surface-muted">
              <X className="size-6" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("menu.description")}</Dialog.Description>

          <nav aria-label={t("menu.main")} className="divide-y px-4 pb-8">
            <Link href={catalogHref} className="flex min-h-14 items-center text-lg font-semibold text-primary">{t("catalogButton")}</Link>
            {navGroups.filter((group) => group.id !== "catalog").map((group) => (
              <details key={group.id} className="group py-1" open={group.items.some((item) => pathname === item.href)}>
                <summary className={summary}>
                  {t(`nav.groups.${group.id}`)}
                  <span aria-hidden className="text-2xl font-normal text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <ul className="pb-3">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} aria-current={pathname === item.href ? "page" : undefined} className="flex min-h-11 items-center text-muted-foreground hover:text-primary aria-[current=page]:font-semibold aria-[current=page]:text-primary">
                        {t(`nav.items.${item.id}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            <details className="group py-1">
              <summary className={summary}>
                {t("a11y.title")}
                <span aria-hidden className="text-2xl font-normal text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="space-y-4 pb-4 pt-1">
                <ThemeChoice />
                <A11ySettings />
              </div>
            </details>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
