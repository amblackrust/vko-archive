"use client";

import { Check, Link2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * Кнопки «поделиться» (T5.17) для документов, выставок и новостей: Facebook, Telegram, WhatsApp
 * и копирование ссылки (для Instagram веб-шаринга нет). Адрес берётся из браузера после загрузки.
 */
export function ShareButtons({ title }: { title: string }) {
  const t = useTranslations("home.share");
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(window.location.href), []);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const targets = [
    { id: "facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { id: "telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}` },
    { id: "whatsapp", href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}` },
  ];
  const buttonClass = "inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-surface-muted";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("copyManual"), url);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("label")}>
      <span className="text-sm text-muted-foreground">{t("label")}:</span>
      {url && targets.map(({ id, href }) => (
        <a key={id} href={href} target="_blank" rel="noopener noreferrer" className={buttonClass}>
          <Send className="size-4" aria-hidden /> {t(id)}
          <span className="sr-only">({t("external")})</span>
        </a>
      ))}
      <button type="button" onClick={copy} className={buttonClass}>
        {copied ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}
