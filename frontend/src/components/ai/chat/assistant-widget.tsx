"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Maximize2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { LogoMark } from "@/components/layout/logo";
import { AssistantMark } from "./assistant-mark";
import { Chat } from "./chat";
import { OPEN_EVENT, QUICK_QUESTIONS } from "./quick";

const headerButton = "grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground [&_svg]:size-[1.125rem]";

/**
 * «Архивный помощник» на всех страницах: круглая кнопка внизу справа открывает плавающее окно диалога
 * (Radix Dialog: фокус заперт внутри, Esc закрывает). На телефоне окно занимает весь экран.
 * В админке и на странице /assistant кнопки нет.
 */
export function AssistantWidget() {
  const t = useTranslations("ai");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [autoAsk, setAutoAsk] = useState("");
  useEffect(() => setOpen(false), [pathname]);
  // Кнопки «Спросить помощника» на страницах записей открывают окно и передают вопрос.
  useEffect(() => {
    const onOpen = (event: Event) => {
      setAutoAsk((event as CustomEvent<string>).detail);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);
  if (pathname.startsWith("/admin") || pathname === "/assistant") return null;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setAutoAsk(""); }}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={t("widget.open")}
          className="group fixed bottom-5 right-5 z-40 flex h-14 items-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_28px_-10px_rgb(50_71_211/0.75)] transition-transform hover:-translate-y-0.5 active:scale-95 print:hidden"
        >
          <span className="grid size-14 place-items-center"><AssistantMark className="size-6" /></span>
          <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-[0.9375rem] font-semibold transition-[max-width,padding] duration-300 group-hover:max-w-56 group-hover:pr-5 group-focus-visible:max-w-56 group-focus-visible:pr-5 lg:block">
            {t("widget.open")}
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1d2a52]/20 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById("assistant-input")?.focus();
          }}
          className="fixed inset-0 z-50 flex origin-bottom-right flex-col overflow-hidden bg-surface shadow-[0_24px_70px_-20px_rgb(18_26_43/0.45)] duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(44rem,calc(100dvh-2.5rem))] sm:w-[30rem] sm:rounded-3xl"
        >
          <header className="flex items-center gap-3 border-b bg-surface px-5 py-3">
            <LogoMark className="size-8 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-bold leading-tight">{t("widget.title")}</Dialog.Title>
              <Dialog.Description className="truncate text-sm text-muted-foreground">{t("widget.description")}</Dialog.Description>
            </div>
            <Link href="/assistant" aria-label={t("widget.fullPage")} title={t("widget.fullPage")} className={headerButton}><Maximize2 aria-hidden /></Link>
            <Dialog.Close aria-label={t("widget.close")} className={headerButton}><X aria-hidden /></Dialog.Close>
          </header>
          <Chat quick={QUICK_QUESTIONS.map((key) => t(`widget.quick.${key}`))} className="flex-1" autoAsk={autoAsk} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
