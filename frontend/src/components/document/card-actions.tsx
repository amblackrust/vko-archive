"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Notice = { text: string; failed: boolean } | null;

/** Кнопки «копировать шифр» и «поделиться». Результат озвучивается через role=status. */
export function CardActions({ code, title }: { code: string | null; title: string }) {
  const t = useTranslations("document.actions");
  const [notice, setNotice] = useState<Notice>(null);

  async function copy(text: string, ok: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ text: ok, failed: false });
    } catch {
      setNotice({ text: t("copyFailed"), failed: true });
    }
  }

  async function share() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch (error) {
        // Отмена диалога пользователем — не ошибка.
        if (!(error instanceof DOMException && error.name === "AbortError")) setNotice({ text: t("shareFailed"), failed: true });
      }
      return;
    }
    await copy(url, t("linkCopied"));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {code && (
        <Button variant="outline" size="sm" onClick={() => copy(code, t("copied"))}>
          <Copy aria-hidden />
          {t("copyCode")}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={share}>
        <Share2 aria-hidden />
        {t("share")}
      </Button>
      <span role="status" className={`inline-flex items-center gap-1 text-sm ${notice?.failed ? "text-destructive" : "text-muted-foreground"}`}>
        {notice && !notice.failed && <Check className="size-4" aria-hidden />}
        {notice?.text}
      </span>
    </div>
  );
}
