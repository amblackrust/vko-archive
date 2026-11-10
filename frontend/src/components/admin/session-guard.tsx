"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SESSION_IDLE_MS, getLastActivity } from "@/lib/api/admin";
import { useAdmin } from "./admin-provider";
import { Notice } from "./notice";
import { useApiError } from "./use-api-error";

const WARN_BEFORE_MS = 2 * 60 * 1000;

/** За 2 минуты до конца сессии предлагает продлить; по истечении возвращает на форму входа. */
export function SessionGuard() {
  const t = useTranslations("admin.session");
  const describe = useApiError();
  const { extend, expire, logout } = useAdmin();
  const [remaining, setRemaining] = useState(SESSION_IDLE_MS);
  const [error, setError] = useState<string | null>(null);

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

  const warning = remaining > 0 && remaining <= WARN_BEFORE_MS;
  const seconds = Math.max(0, Math.ceil(remaining / 1000));

  async function keepAlive() {
    try {
      await extend();
      setError(null);
    } catch (caught) {
      setError(describe(caught));
    }
  }

  return (
    <Dialog.Root open={warning}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border bg-surface p-6 shadow-lg"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <Dialog.Title className="text-lg font-semibold">{t("title")}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            {t("text", { minutes: Math.floor(seconds / 60), seconds: String(seconds % 60).padStart(2, "0") })}
          </Dialog.Description>
          {error && <Notice kind="error">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => void logout()}>
              {t("logout")}
            </Button>
            <Button onClick={keepAlive}>{t("extend")}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
