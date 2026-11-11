"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { CabinetError, cabinetFetch } from "./api";

/** Подтверждение e-mail по ссылке из письма. Запрос уходит один раз при загрузке страницы. */
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
      (e) => setStatus(e instanceof CabinetError && e.code === "invalid_token" ? "invalid" : "failed"),
    );
  }, [token]);

  return (
    <section className="max-w-md space-y-4">
      {status === "pending" && <p role="status">{t("emailConfirm.pending")}</p>}
      {status === "done" && <p role="status">{t("emailConfirm.done")}</p>}
      {status === "invalid" && <p role="alert" className="text-destructive">{t("emailConfirm.invalid")}</p>}
      {status === "failed" && <p role="alert" className="text-destructive">{t("errors.generic")}</p>}
      {(status === "done" || status === "invalid" || status === "failed") && (
        <Button asChild variant="outline">
          <Link href="/cabinet">{t("emailConfirm.toCabinet")}</Link>
        </Button>
      )}
    </section>
  );
}
