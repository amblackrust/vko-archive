import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Виды пометок из PLAN.md §8. Тексты — в messages/<locale>/common.json, ключ demo.<kind>. */
export type DemoKind = "badge" | "noTranslation" | "approxCoords" | "aiGenerated" | "demoIntegration";

interface DemoBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** По умолчанию «ДЕМО» (вымышленный документ/материал). */
  kind?: DemoKind;
}

export function DemoBadge({ kind = "badge", className, ...props }: DemoBadgeProps) {
  const t = useTranslations("common.demo");
  return (
    <span
      title={t("title")}
      className={cn(
        "inline-flex items-center rounded-sm border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent-soft-foreground",
        className,
      )}
      {...props}
    >
      {t(kind)}
    </span>
  );
}
