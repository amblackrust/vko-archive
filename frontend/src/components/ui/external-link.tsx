import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Ссылка на внешний ресурс: открывается в новой вкладке и явно помечена значком и текстом для экранного диктора. */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const t = useTranslations("common");
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-start gap-1 hover:text-primary hover:underline", className)}>
      {children}
      <ArrowUpRight className="mt-1 size-4 shrink-0" aria-hidden />
      <span className="sr-only">({t("external")})</span>
    </a>
  );
}
