import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Плитка-переход на раздел сайта: название, пояснение и стрелка. В сетке с `auto-rows-fr` плитки равны по высоте.
 * `accent` — закрашенная плитка «всё сразу» (последняя в сетке, чтобы не оставалось пустой ячейки).
 */
export function LinkTile({ href, title, text, accent, className }: { href: string; title: string; text?: string; accent?: boolean; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col gap-1.5 p-5",
        accent ? "rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary-hover" : "card lift",
        className,
      )}
    >
      <span className={cn("text-[1.0625rem] font-semibold leading-snug", !accent && "group-hover:text-primary")}>{title}</span>
      {text && <span className={cn("text-[0.9375rem]", accent ? "opacity-85" : "text-muted-foreground")}>{text}</span>}
      <ArrowRight className={cn("mt-auto size-4 translate-y-1 transition-transform group-hover:translate-x-1", !accent && "text-muted-foreground group-hover:text-primary")} aria-hidden />
    </Link>
  );
}
