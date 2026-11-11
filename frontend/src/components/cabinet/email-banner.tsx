"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CabinetError, cabinetFetch } from "./api";
import { errorKey } from "./errors";

/** Напоминание о неподтверждённом e-mail; повторная отправка письма с подтверждением. */
export function EmailBanner() {
  const t = useTranslations("cabinet");
  const locale = useLocale();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    setMessage(null);
    try {
      await cabinetFetch("/auth/email/resend", { method: "POST", body: { lang: locale } });
      setMessage({ kind: "ok", text: t("emailBanner.sent") });
    } catch (e) {
      const tooOften = e instanceof CabinetError && e.status === 429;
      setMessage({ kind: "error", text: t(tooOften ? "emailBanner.tooOften" : errorKey(e instanceof CabinetError ? e.code : "generic")) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{t("emailBanner.text")}</p>
        <Button variant="outline" size="sm" onClick={() => void resend()} disabled={busy}>{t("emailBanner.resend")}</Button>
      </div>
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm text-destructive" : "text-sm"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
