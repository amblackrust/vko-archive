"use client";

import { Check, Copy, Printer, Quote } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Notice = { text: string; failed: boolean } | null;

/**
 * Действия карточки: копировать шифр, скопировать готовую ссылку для цитирования, распечатать.
 * `citation` — описание без адреса; адрес страницы и дата обращения добавляются в браузере.
 */
export function CardActions({ code, citation }: { code: string | null; citation: string }) {
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

  function cite() {
    const now = new Date();
    const accessed = [now.getDate(), now.getMonth() + 1].map((n) => String(n).padStart(2, "0")).join(".") + `.${now.getFullYear()}`;
    return copy(`${citation} URL: ${window.location.href} (${t("accessed")}: ${accessed}).`, t("cited"));
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-noprint>
      {code && (
        <Button variant="outline" size="sm" onClick={() => copy(code, t("copied"))}>
          <Copy aria-hidden />
          {t("copyCode")}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={cite}>
        <Quote aria-hidden />
        {t("cite")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer aria-hidden />
        {t("print")}
      </Button>
      <span role="status" className={`inline-flex items-center gap-1 text-sm ${notice?.failed ? "text-destructive" : "text-muted-foreground"}`}>
        {notice && !notice.failed && <Check className="size-4" aria-hidden />}
        {notice?.text}
      </span>
    </div>
  );
}
