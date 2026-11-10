"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { notificationsApi, type Notification } from "@/lib/api/admin";
import { cn } from "@/lib/utils";
import { Notice } from "./notice";
import { useApiError } from "./use-api-error";

const POLL_MS = 60_000;

/** Колокольчик уведомлений. Опрос — фоновыми запросами (X-Background: 1): сессия по нему не продлевается. */
export function NotificationBell() {
  const t = useTranslations("admin.bell");
  const locale = useLocale();
  const describe = useApiError();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (background: boolean) => {
      try {
        const data = await notificationsApi.list(background);
        setItems(data.items);
        setUnread(data.unread);
        setError(null);
      } catch (caught) {
        setError(describe(caught));
      }
    },
    // describe пересоздаётся на каждый рендер; зависимость от локали достаточна
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  useEffect(() => {
    void load(true);
    const timer = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function markAll() {
    try {
      await notificationsApi.readAll();
      await load(false);
    } catch (caught) {
      setError(describe(caught));
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={unread ? t("labelUnread", { count: unread }) : t("label")}
        aria-expanded={open}
        aria-controls="admin-bell-panel"
        onClick={() => {
          setOpen((value) => !value);
          void load(true);
        }}
      >
        <Bell />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <div
          id="admin-bell-panel"
          className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border bg-surface p-3 shadow-lg"
          onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("title")}</h2>
            {unread > 0 && (
              <Button variant="link" size="sm" onClick={markAll}>
                {t("markAll")}
              </Button>
            )}
          </div>
          {error && <Notice kind="error">{error}</Notice>}
          {!error && items === null && <Notice kind="loading">{t("loading")}</Notice>}
          {items?.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t("empty")}</p>}
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {items?.map((item) => (
              <li key={item.id} className={cn("rounded-md px-2 py-1.5 text-sm", !item.is_read && "bg-accent-soft text-accent-soft-foreground")}>
                <p>{item.message[locale] ?? item.message.ru ?? item.message.kk ?? item.message.en ?? item.kind}</p>
                <time className="text-xs text-muted-foreground" dateTime={item.created_at}>
                  {new Date(item.created_at).toLocaleString(locale)}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
