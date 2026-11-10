"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useApiError } from "./use-api-error";
import { Notice } from "./notice";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Выполняется при подтверждении; исключение показывается в окне, окно остаётся открытым. */
  onConfirm: () => Promise<void>;
  /** Опасное действие (блокировка, удаление): красная кнопка. */
  danger?: boolean;
}

/** Модалка подтверждения опасных действий (T6.15). Фокус заперт, Esc закрывает; во время запроса — недоступна. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, danger }: ConfirmDialogProps) {
  const t = useTranslations("admin.common");
  const describe = useApiError();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setError(null);
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border bg-surface p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">{description}</Dialog.Description>
          {error && <Notice kind="error">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" disabled={pending}>
                {t("cancel")}
              </Button>
            </Dialog.Close>
            <Button
              className={danger ? "bg-destructive text-destructive-foreground" : undefined}
              onClick={confirm}
              disabled={pending}
            >
              {pending ? t("working") : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
