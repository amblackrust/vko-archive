import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Виды пометок из PLAN.md §8. Тексты — в messages/<locale>/common.json, ключ demo.<kind>. */
export type DemoKind = "noTranslation" | "approxCoords" | "aiGenerated";

interface DemoBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  kind?: DemoKind;
}

/** Пометка в виде штампа: красная рамка, капитель. */
export function DemoBadge({ kind = "noTranslation", className, ...props }: DemoBadgeProps) {
  const t = useTranslations("common.demo");
  return (
    <span
      className={cn(
        "caps inline-flex items-center rounded-sm border border-accent/60 px-1.5 py-px text-xs leading-tight text-accent",
        className,
      )}
      {...props}
    >
      {t(kind)}
    </span>
  );
}
