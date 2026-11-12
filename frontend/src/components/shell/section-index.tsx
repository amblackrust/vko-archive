"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { Menu, X } from "lucide-react";
import { UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ThemeSwitch } from "./theme-switch";
import { A11yPanel } from "./a11y-panel";
import { GROUPS, PRIMARY } from "@/lib/nav";
import { IconButton, iconButtonClass } from "@/components/ui/icon-button";
import { SPRING_SHEET, project } from "@/lib/motion";

/** Full index of every public section; also the mobile navigation. A sheet that can be flicked away upward. */
export function SectionIndex() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const controls = useDragControls();

  const onDragEnd = (_: PointerEvent, info: PanInfo) => {
    // Decide by where the flick would come to rest, not by where the finger let go.
    if (info.offset.y + project(info.velocity.y) < -120) close();
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <IconButton label={t("common.menu")}>
          <Menu size={20} />
        </IconButton>
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-paper/92 backdrop-blur-2xl"
                initial={{ y: "-100%" }}
                animate={{ y: 0 }}
                exit={{ y: "-100%" }}
                transition={SPRING_SHEET}
                drag="y"
                dragListener={false}
                dragControls={controls}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.5, bottom: 0.05 }}
                onDragEnd={onDragEnd}
              >
                <div className="wrap flex h-[var(--header-h)] touch-none items-center justify-between" onPointerDown={(e) => e.target === e.currentTarget && controls.start(e)}>
                  <Dialog.Title className="font-display text-xl">{t("nav.allSections")}</Dialog.Title>
                  <Dialog.Close asChild>
                    <IconButton label={t("common.close")}>
                      <X size={20} />
                    </IconButton>
                  </Dialog.Close>
                </div>
                <nav aria-label={t("nav.allSections")} className="wrap grid gap-x-10 gap-y-10 pb-16 pt-6 md:grid-cols-2 xl:grid-cols-4">
                  {GROUPS.map((group, gi) => (
                    <motion.section
                      key={group.key}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...SPRING_SHEET, delay: 0.06 + gi * 0.05 }}
                    >
                      <h2 className="mb-3 border-b border-dotted border-frame-strong pb-2 font-sans text-sm font-normal tracking-normal text-ink-3">
                        {t(`nav.groups.${group.key}`)}
                      </h2>
                      <ul>
                        {group.items.map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={close}
                              className="-mx-3 block rounded-2xl px-3 py-2 font-display text-2xl no-underline transition-colors hover:bg-mount-2 hover:text-action"
                            >
                              {t(`nav.items.${item.key}`)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </motion.section>
                  ))}
                </nav>
                <div className="wrap flex items-center gap-1 border-t border-frame py-3 sm:hidden">
                  <ThemeSwitch />
                  <A11yPanel />
                  <Link href="/cabinet" onClick={close} aria-label={t("common.cabinet")} title={t("common.cabinet")} className={iconButtonClass}>
                    <UserRound size={18} />
                  </Link>
                </div>
                <ul className="wrap flex flex-wrap gap-x-6 gap-y-1 border-t border-frame py-6 md:hidden">
                  {PRIMARY.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} onClick={close} className="py-1 text-ink-2">
                        {t(`nav.primary.${item.key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div
                  aria-hidden
                  onPointerDown={(e) => controls.start(e)}
                  className="sticky bottom-0 grid h-8 touch-none place-items-center"
                >
                  <span className="h-1.5 w-12 rounded-full bg-frame-strong" />
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
