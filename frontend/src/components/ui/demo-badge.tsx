import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Виды пометок из PLAN.md §8. Тексты — в messages/<locale>/common.json, ключ demo.<kind>. */
export type DemoKind = "noTranslation" | "approxCoords" | "aiGenerated";

interface DemoBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  kind?: DemoKind;
}

export function DemoBadge({ kind = "noTranslation", className, ...props }: DemoBadgeProps) {
  const t = useTranslations("common.demo");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    >
      {t(kind)}
    </span>
  );
}
