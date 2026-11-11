"use client";

import { useEffect, useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CabinetError, cabinetFetch } from "./api";

const KNOWN = ["invalid_credentials", "email_taken", "invalid_email", "password_length", "password_too_weak", "password_unchanged", "rate_limited", "limit_reached", "not_found", "invalid_token"];

/** Код ошибки API кабинета; сеть и неизвестные коды — общая ошибка. Тексты — cabinet.errors.<код>. */
export const errorCode = (error: unknown): string => (error instanceof CabinetError && KNOWN.includes(error.code) ? error.code : "generic");

/** Загрузка списка кабинета и перезагрузка после изменений. `error` — код ошибки или null. */
export function useCabinetList<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setData(await cabinetFetch<T>(path));
      setError(null);
    } catch (caught) {
      setError(errorCode(caught));
    }
  }

  useEffect(() => {
    void reload();
    // reload пересоздаётся каждый рендер; перечитываем только при смене пути
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  /** Выполняет изменение и перечитывает список; возвращает true при успехе. */
  async function mutate(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      await reload();
      return true;
    } catch (caught) {
      setError(errorCode(caught));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { data, error, busy, mutate };
}

interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  /** Ссылка или кнопка справа от подписи (например, «Забыли пароль?»). */
  aside?: React.ReactNode;
  className?: string;
}

/** Поле с подписью, подсказкой и ошибкой под ним; пароль можно показать кнопкой. */
export function TextInput({ label, hint, error, aside, className, type = "text", ...props }: TextInputProps) {
  const t = useTranslations("cabinet.auth");
  const id = useId();
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        {aside}
      </div>
      <div className="relative">
        <Input id={id} type={password && visible ? "text" : type} aria-describedby={described} aria-invalid={error ? true : undefined} className={cn("h-11 text-base", password && "pr-12", error && "border-destructive")} {...props} />
        {password && (
          <button type="button" aria-pressed={visible} aria-label={t("showPassword")} onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground">
            {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        )}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
      {hint && <div id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Требования к новому паролю: выполненные отмечаются галочкой по мере ввода. */
export function PasswordRules({ value }: { value: string }) {
  const t = useTranslations("cabinet.auth.rules");
  const rules = [
    { id: "length", ok: value.length >= 10 && value.length <= 256 },
    { id: "spaces", ok: value.length > 0 && value === value.trim() },
    { id: "simple", ok: new Set(value).size >= 4 },
  ];
  return (
    <ul className="space-y-0.5">
      {rules.map((rule) => (
        <li key={rule.id} className={cn("flex items-start gap-2", rule.ok && "text-foreground")}>
          {rule.ok ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span>{t(rule.id)}<span className="sr-only"> — {rule.ok ? t("done") : t("pending")}</span></span>
        </li>
      ))}
    </ul>
  );
}

interface ConfirmProps {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}

/** Подтверждение необратимого действия: удаление подборки, очистка истории, удаление кабинета. */
export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onClose }: ConfirmProps) {
  const t = useTranslations("cabinet");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (caught) {
      setError(errorCode(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !pending && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 card space-y-4 p-6 animate-in fade-in zoom-in-95 duration-200">
          <Dialog.Title className="text-xl font-bold leading-snug">{title}</Dialog.Title>
          <Dialog.Description className="text-muted-foreground">{text}</Dialog.Description>
          {error && <p role="alert" className="text-sm text-destructive">{t(`errors.${error}`)}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>{t("cancel")}</Button>
            <Button onClick={() => void confirm()} disabled={pending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{confirmLabel}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
