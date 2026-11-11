"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { CabinetError, cabinetFetch } from "./api";
import { StatusNote } from "./form";

/** Подтверждение адреса почты по ссылке из письма. Запрос уходит один раз при загрузке страницы. */
export function EmailConfirm({ token }: { token: string }) {
  const t = useTranslations("cabinet");
  const [status, setStatus] = useState<"pending" | "done" | "invalid" | "failed">(token ? "pending" : "invalid");
  // Ref переживает повторный запуск эффекта в StrictMode (dev): токен уходит один раз.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    cabinetFetch("/auth/email/confirm", { method: "POST", body: { token } }).then(
      () => setStatus("done"),
      (error) => setStatus(error instanceof CabinetError && error.code === "invalid_token" ? "invalid" : "failed"),
    );
  }, [token]);

  return (
    <div className="max-w-xl space-y-5" aria-live="polite">
      {status === "pending" && <StatusNote>{t("emailConfirm.pending")}</StatusNote>}
      {status === "done" && <StatusNote tone="success" title={t("emailConfirm.done")}>{t("emailConfirm.doneText")}</StatusNote>}
      {status === "invalid" && <StatusNote tone="warning" title={t("emailConfirm.invalid")}>{t("emailConfirm.invalidText")}</StatusNote>}
      {status === "failed" && <StatusNote tone="warning">{t("errors.generic")}</StatusNote>}
      {status !== "pending" && (
        <Button asChild variant={status === "done" ? "primary" : "outline"}>
          <Link href={status === "done" ? "/cabinet" : "/cabinet?section=account"}>{t("emailConfirm.toCabinet")}</Link>
        </Button>
      )}
    </div>
  );
}
