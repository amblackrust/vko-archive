"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const dots: Record<Tone, string> = {
  neutral: "bg-border-strong",
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-accent",
  danger: "bg-destructive",
};

/** Пометка состояния: цветная точка и текст — смысл несёт подпись, цвет только помогает глазу. */
export function Badge({ tone = "neutral", className, children, title }: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", dots[tone])} aria-hidden />
      {children}
    </span>
  );
}

export const WORKFLOW_STATUSES = ["draft", "review", "needs_changes", "approved", "published", "archived"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

const workflow: Record<WorkflowStatus, Tone> = {
  draft: "neutral",
  review: "info",
  needs_changes: "warning",
  approved: "info",
  published: "success",
  archived: "neutral",
};

/** Статус согласования: черновик, на проверке, на доработке, одобрено, опубликовано, в архиве. */
export function WorkflowBadge({ status, className }: { status: string; className?: string }) {
  const t = useTranslations("admin.workflow.status");
  const tone = workflow[status as WorkflowStatus];
  if (!tone) return <Badge className={className}>{status}</Badge>;
  return <Badge tone={tone} className={className}>{t(status)}</Badge>;
}
