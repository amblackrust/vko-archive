"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SESSION_IDLE_MS, getLastActivity } from "@/lib/api/admin";
import { useAdmin } from "./admin-provider";
import { AdminDialog } from "./kit/dialog";
import { useAction } from "./kit/hooks";
import { Notice } from "./kit/notice";

const WARN_BEFORE_MS = 2 * 60 * 1000;

/** За 2 минуты до конца сессии предлагает продлить; по истечении возвращает на форму входа. */
export function SessionGuard() {
  const t = useTranslations("admin.session");
  const { extend, expire, logout } = useAdmin();
  const action = useAction();
  const [remaining, setRemaining] = useState(SESSION_IDLE_MS);

  useEffect(() => {
    const tick = () => {
      const left = SESSION_IDLE_MS - (Date.now() - getLastActivity());
      setRemaining(left);
      if (left <= 0) expire();
    };
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [expire]);

  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  return (
    <AdminDialog
      open={remaining > 0 && remaining <= WARN_BEFORE_MS}
      onClose={() => undefined}
      modal
      size="sm"
      title={t("title")}
      description={t("text", { minutes: Math.floor(seconds / 60), seconds: String(seconds % 60).padStart(2, "0") })}
      footer={
        <>
          <Button variant="outline" disabled={action.pending} onClick={() => void action.run(logout)}>{t("logout")}</Button>
          <Button disabled={action.pending} onClick={() => void action.run(extend)}>{t("extend")}</Button>
        </>
      }
    >
      {action.error ? <Notice kind="error">{action.error}</Notice> : <p className="text-sm">{t("why")}</p>}
    </AdminDialog>
  );
}
