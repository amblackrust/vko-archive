"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const TARGETS = [
  { id: "telegram", href: (url: string, title: string) => `https://t.me/share/url?url=${url}&text=${title}` },
  { id: "whatsapp", href: (url: string, title: string) => `https://wa.me/?text=${title}%20${url}` },
  { id: "facebook", href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${url}` },
] as const;

/**
 * «Поделиться» одной кнопкой: на телефоне открывает системное окно, на компьютере — небольшое меню
 * (Telegram, WhatsApp, Facebook, копирование ссылки). Адрес страницы берётся из браузера.
 */
export function ShareButtons({ title, className }: { title: string; className?: string }) {
  const t = useTranslations("home.share");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function toggle() {
    // Системное окно «Поделиться» есть на телефонах; отмена пользователем — не ошибка.
    if (!open && typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title, url: window.location.href }).catch(() => undefined);
      return;
    }
    setOpen(!open);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("copyManual"), window.location.href);
    }
  }

  const item = "flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-[0.9375rem] hover:bg-primary-soft hover:text-primary";
  return (
    <div ref={root} className={cn("relative", className)} data-noprint>
      <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="menu" className="flex h-9 items-center gap-2 rounded-md border bg-surface px-3 text-sm font-semibold transition-colors hover:border-primary hover:text-primary">
        <Share2 className="size-4" aria-hidden />
        {t("label")}
      </button>
      {open && (
        <div role="menu" aria-label={t("label")} className="absolute left-0 top-full z-20 mt-2 w-56 rounded-lg bg-surface p-2 shadow-[0_12px_32px_-8px_rgb(18_26_43/0.22)] ring-1 ring-border animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {TARGETS.map((target) => (
            <a
              key={target.id}
              role="menuitem"
              href={target.href(encodeURIComponent(window.location.href), encodeURIComponent(title))}
              target="_blank"
              rel="noopener noreferrer"
              className={item}
            >
              {t(target.id)}
              <span className="sr-only">({t("external")})</span>
            </a>
          ))}
          <button type="button" role="menuitem" onClick={copy} className={item}>
            {copied ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      )}
    </div>
  );
}
