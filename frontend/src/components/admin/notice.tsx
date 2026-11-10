import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  error: { box: "border-destructive/40 text-destructive", icon: AlertCircle, role: "alert" },
  success: { box: "bg-accent-soft text-accent-soft-foreground", icon: CheckCircle2, role: "status" },
  info: { box: "bg-surface-muted", icon: Info, role: "status" },
  loading: { box: "bg-surface-muted text-muted-foreground", icon: Loader2, role: "status" },
} as const;

interface NoticeProps {
  kind: keyof typeof styles;
  children: React.ReactNode;
  /** Кнопка действия справа (например, «Повторить»). */
  action?: React.ReactNode;
  className?: string;
}

/** Сообщение о состоянии операции: загрузка, ошибка, успех, информация (T6.15). */
export function Notice({ kind, children, action, className }: NoticeProps) {
  const { box, icon: Icon, role } = styles[kind];
  return (
    <div role={role} className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", box, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", kind === "loading" && "animate-spin")} aria-hidden />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}
