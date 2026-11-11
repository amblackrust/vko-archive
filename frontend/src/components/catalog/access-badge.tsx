import { useTranslations } from "next-intl";
import type { DocumentItem } from "@/lib/api/catalog";
import { cn } from "@/lib/utils";

const dots: Record<DocumentItem["file_access"], string> = {
  open: "bg-success",
  restricted: "bg-accent",
  closed: "bg-destructive",
  needs_review: "bg-border-strong",
};

/** Статус доступа к цифровой копии: цветная точка и подпись — смысл несёт текст, а не цвет. */
export function AccessBadge({ access, className }: { access: DocumentItem["file_access"]; className?: string }) {
  const t = useTranslations("catalog.access");
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-medium", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", dots[access])} aria-hidden />
      {t(access)}
    </span>
  );
}
