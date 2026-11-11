"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { useMe } from "../admin-provider";

const kinds = {
  error: { box: "border-destructive/40 bg-destructive-soft", tint: "text-destructive", icon: CircleAlert, role: "alert" },
  warning: { box: "border-accent/40 bg-warning-soft text-warning-soft-foreground", tint: "", icon: TriangleAlert, role: "status" },
  success: { box: "border-success/40 bg-success-soft", tint: "text-success", icon: CircleCheck, role: "status" },
  info: { box: "border-transparent bg-primary-soft", tint: "text-primary", icon: Info, role: "note" },
  loading: { box: "border-transparent bg-primary-soft", tint: "text-primary", icon: LoaderCircle, role: "status" },
} as const;

interface NoticeProps {
  kind: keyof typeof kinds;
  title?: string;
  children: React.ReactNode;
  /** Кнопка действия справа (например, «Повторить»). */
  action?: React.ReactNode;
  className?: string;
}

/** Сообщение о состоянии операции на месте: ход выполнения, ошибка, успех, пояснение. Значок и текст, не только цвет. */
export function Notice({ kind, title, children, action, className }: NoticeProps) {
  const { box, tint, icon: Icon, role } = kinds[kind];
  return (
    <div role={role} className={cn("flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm", box, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", tint, kind === "loading" && "animate-spin")} aria-hidden />
      <div className="min-w-0 flex-1 break-words">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
      {action}
    </div>
  );
}

/** Ошибка загрузки с кнопкой «Повторить». */
export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTranslations("admin.common");
  return (
    <Notice kind="error" action={onRetry && <Button size="sm" variant="outline" onClick={onRetry}>{t("retry")}</Button>}>
      {message}
    </Notice>
  );
}

/** Пустое состояние списка: что здесь будет и что сделать, чтобы оно появилось. */
export function EmptyState({ title, children, action, className }: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 px-4 py-6 sm:flex-row sm:items-center sm:gap-4 sm:px-6", className)}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children && <p className="text-sm text-muted-foreground">{children}</p>}
      </div>
      {action}
    </div>
  );
}

/** Раздел закрыт для роли: объясняем причину и к кому обратиться, а не показываем пустой экран. */
export function NoAccess() {
  const t = useTranslations("admin");
  const me = useMe();
  const roles = me.roles.map((code) => (t.has(`users.roles.${code}`) ? t(`users.roles.${code}`) : code)).join(", ");
  return (
    <div className="card mx-auto max-w-xl p-6 sm:p-8">
      <h1 className="text-xl">{t("access.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("access.text", { roles })}</p>
      <Button asChild variant="outline" className="mt-4">
        <Link href="/admin">{t("access.toDashboard")}</Link>
      </Button>
    </div>
  );
}
