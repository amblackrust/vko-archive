"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { catalogHref, navGroups } from "./nav-config";
import { SocialLinks } from "./social-links";

export function MobileMenu() {
  const t = useTranslations("layout");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("menu.open")}>
          <Menu />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col overflow-y-auto bg-background p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-serif text-lg font-semibold">{t("menu.mobile")}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={t("menu.close")}>
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("menu.main")}</Dialog.Description>
          <Button asChild className="mt-4">
            <Link href={catalogHref}>{t("catalogButton")}</Link>
          </Button>
          <nav aria-label={t("menu.main")} className="mt-4 flex flex-col gap-4">
            {navGroups.map((group) => (
              <section key={group.id}>
                <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground font-sans">
                  {t(`nav.groups.${group.id}`)}
                </h2>
                <ul className="mt-1">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} className="block rounded-md px-3 py-2 hover:bg-surface-muted">
                        {t(`nav.items.${item.id}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
          <SocialLinks className="mt-6" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
