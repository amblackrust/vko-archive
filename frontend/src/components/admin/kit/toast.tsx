"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ToastItem {
  id: number;
  kind: "success" | "error";
  text: string;
}
interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const SUCCESS_MS = 6000;

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>");
  return value;
}

/**
 * Всплывающие сообщения о результате действия (под верхней панелью, чтобы не закрывать кнопки внизу окон).
 * Успех исчезает сам, ошибка остаётся, пока её не закроют.
 * Область объявлена aria-live, поэтому результат слышен и без взгляда на экран.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin.common");
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const push = useCallback(
    (kind: ToastItem["kind"], text: string) => {
      const id = nextId.current++;
      setItems((current) => [...current.slice(-2), { id, kind, text }]);
      if (kind === "success") setTimeout(() => dismiss(id), SUCCESS_MS);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(() => ({ success: (text) => push("success", text), error: (text) => push("error", text) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div data-admin-toasts aria-live="polite" className="pointer-events-none fixed inset-x-4 top-16 z-[60] flex flex-col items-end gap-2">
        {items.map((item) => {
          const Icon = item.kind === "error" ? CircleAlert : CircleCheck;
          return (
            <div
              key={item.id}
              role={item.kind === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border bg-surface p-3.5 text-sm shadow-card animate-in fade-in slide-in-from-top-2 duration-200",
                item.kind === "error" ? "border-destructive/50" : "border-success/50",
              )}
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", item.kind === "error" ? "text-destructive" : "text-success")} aria-hidden />
              <p className="min-w-0 flex-1 break-words">{item.text}</p>
              <button type="button" onClick={() => dismiss(item.id)} aria-label={t("dismiss")} className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
