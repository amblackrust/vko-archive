"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { notificationsApi, type Notification } from "@/lib/api/admin";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge } from "./kit/badge";
import { useAction } from "./kit/hooks";
import { Notice } from "./kit/notice";
import { useApiError } from "./kit/use-api-error";
import { ObjectDialog } from "./objects/object-dialog";
import { KINDS } from "./objects/specs";

const POLL_MS = 60_000;

/** Текст уведомления на языке интерфейса. */
export const notificationText = (item: Notification, locale: string) => item.message[locale] ?? item.message.ru ?? item.message.kk ?? item.message.en ?? item.kind;
/** Уведомление ведёт к объекту, который можно открыть в рабочей панели. */
export const notificationTarget = (item: Notification) => (item.object_type && item.object_id && item.object_type in KINDS ? { kind: item.object_type, id: item.object_id } : null);

/** Колокольчик уведомлений о согласовании. Опрос — фоновыми запросами (X-Background: 1): сессия по нему не продлевается. */
export function NotificationBell() {
  const t = useTranslations("admin.bell");
  const types = useTranslations("admin.objectTypes");
  const locale = useLocale();
  const describe = useApiError();
  const action = useAction();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ kind: string; id: string } | null>(null);

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

  // Щелчок вне панели и Esc закрывают её; фокус возвращается на кнопку.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => !root.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      root.current?.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openObject(item: Notification) {
    setTarget(notificationTarget(item));
    setOpen(false);
    if (!item.is_read) void action.run(() => notificationsApi.read(item.id)).then(() => load(false));
  }

  return (
    <div ref={root} className="relative">
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
          <span aria-hidden className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-bold leading-4 text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <section id="admin-bell-panel" aria-label={t("title")} className="absolute right-0 z-40 mt-2 w-96 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border bg-surface shadow-card animate-in fade-in slide-in-from-top-1 duration-150 max-sm:fixed max-sm:inset-x-3 max-sm:top-14 max-sm:w-auto">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <h2 className="text-base font-bold">{t("title")}</h2>
            {unread > 0 && (
              <Button variant="link" size="sm" className="px-0" disabled={action.pending} onClick={() => void action.run(() => notificationsApi.readAll()).then(() => load(false))}>
                {t("markAll")}
              </Button>
            )}
          </div>
          <div className="space-y-2 empty:hidden [&:not(:empty)]:p-3">
            {(error ?? action.error) && <Notice kind="error">{error ?? action.error}</Notice>}
            {!error && items === null && <Notice kind="loading">{t("loading")}</Notice>}
          </div>
          {items?.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">{t("empty")}</p>}
          <ul className="max-h-[min(24rem,60dvh)] divide-y overflow-y-auto">
            {items?.map((item) => {
              const body = (
                <>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("min-w-0 break-words", !item.is_read && "font-semibold")}>{notificationText(item, locale)}</span>
                    {!item.is_read && <Badge tone="info">{t("new")}</Badge>}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {item.object_type && types.has(item.object_type) ? `${types(item.object_type)} · ` : ""}
                    <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
                  </span>
                </>
              );
              return (
                <li key={item.id}>
                  {notificationTarget(item) ? (
                    <button type="button" onClick={() => openObject(item)} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-surface-muted">
                      {body}
                      <span className="sr-only">. {t("openObject")}</span>
                    </button>
                  ) : (
                    <div className="px-4 py-2.5 text-sm">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {target && <ObjectDialog key={`${target.kind}-${target.id}`} kind={target.kind} id={target.id} onClose={() => setTarget(null)} onSaved={() => void load(false)} />}
    </div>
  );
}
