import { CircleAlert, CircleCheck, Info, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones: Record<string, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: "border-transparent bg-primary-soft" },
  warning: { icon: CircleAlert, className: "border-accent/30 bg-accent-soft text-accent-soft-foreground" },
  success: { icon: CircleCheck, className: "border-success/30 bg-success-soft" },
  locked: { icon: Lock, className: "border-destructive/30 bg-destructive-soft" },
};

/** Заметка-плашка: «сайт только информирует», условия доступа, пометка об автоматическом тексте. */
export function Notice({ tone = "info", title, className, children }: {
  tone?: "info" | "warning" | "success" | "locked";
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { icon: Icon, className: toneClass } = tones[tone];
  return (
    <div role="note" className={cn("flex items-start gap-3 rounded-lg border p-4 text-sm", toneClass, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
