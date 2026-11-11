"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Notice } from "./notice";
import { useApiError, type ErrorScope } from "./use-api-error";

const sizes = {
  sm: "left-1/2 top-1/2 max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg",
  md: "left-1/2 top-1/2 max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg",
  lg: "left-1/2 top-1/2 max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-lg",
  /** Рабочая панель справа на всю высоту; на телефоне — на весь экран. */
  sheet: "inset-y-0 right-0 w-full max-w-3xl",
};

interface AdminDialogProps {
  open?: boolean;
  onClose: () => void;
  title: string;
  /** Пояснение под заголовком; без него нужен `srDescription` для экранного диктора. */
  description?: React.ReactNode;
  srDescription?: string;
  size?: keyof typeof sizes;
  /** Идёт запрос: окно нельзя закрыть. */
  busy?: boolean;
  /** Закрывается только кнопками (предупреждение о сессии). */
  modal?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Единое окно админки: заголовок, прокручиваемое содержимое, закреплённые кнопки. Фокус заперт внутри, Esc закрывает. */
export function AdminDialog({ open = true, onClose, title, description, srDescription, size = "md", busy, modal, footer, children }: AdminDialogProps) {
  const t = useTranslations("admin.common");
  // Щелчок по всплывающему сообщению не должен закрывать окно под ним.
  const keepOpen = (event: Event) => {
    if (modal || (event.target as HTMLElement | null)?.closest?.("[data-admin-toasts]")) event.preventDefault();
  };
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && !busy && !modal && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50 animate-in fade-in duration-200" />
        <Dialog.Content
          className={cn("fixed z-50 flex flex-col overflow-hidden bg-surface shadow-card animate-in fade-in duration-200", size === "sheet" ? "slide-in-from-right-8" : "zoom-in-95", sizes[size])}
          onEscapeKeyDown={(event) => modal && event.preventDefault()}
          onInteractOutside={keepOpen}
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
            <div className="min-w-0 space-y-1">
              <Dialog.Title className="break-words text-lg font-bold leading-snug">{title}</Dialog.Title>
              <Dialog.Description className={description ? "break-words text-sm text-muted-foreground" : "sr-only"}>{description ?? srDescription ?? title}</Dialog.Description>
            </div>
            {!modal && (
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" className="-m-2 shrink-0" aria-label={t("close")} disabled={busy}>
                  <X />
                </Button>
              </Dialog.Close>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t bg-surface px-5 py-3.5 sm:px-6">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ConfirmDialogProps {
  open?: boolean;
  onClose: () => void;
  title: string;
  /** Что произойдёт после подтверждения и можно ли это отменить. */
  description: string;
  confirmLabel: string;
  /** Исключение показывается в окне, окно остаётся открытым. */
  onConfirm: () => Promise<unknown>;
  /** Необратимое или закрывающее доступ действие: красная кнопка. */
  danger?: boolean;
  scope?: ErrorScope;
  /** Дополнительные поля (например, комментарий к возврату). */
  children?: React.ReactNode;
  confirmDisabled?: boolean;
}

/** Подтверждение опасного действия с текстом последствий. Во время запроса окно недоступно. */
export function ConfirmDialog({ open = true, onClose, title, description, confirmLabel, onConfirm, danger, scope, children, confirmDisabled }: ConfirmDialogProps) {
  const t = useTranslations("admin.common");
  const describe = useApiError(scope);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    // Окно рисуется порталом, но событие React всплывает по дереву компонентов: не отправляем форму-родителя.
    event.stopPropagation();
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminDialog
      open={open}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title={title}
      description={description}
      size="sm"
      busy={pending}
    >
      <form onSubmit={confirm} className="space-y-4">
        {children}
        {error && <Notice kind="error">{error}</Notice>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>{t("cancel")}</Button>
          <Button type="submit" disabled={pending || confirmDisabled} className={danger ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}>
            {pending ? t("working") : confirmLabel}
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}
