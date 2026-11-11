import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

/** Плитка услуги: название, пояснение и строка «где это оформляется» у нижнего края. */
export function ServiceTile({ href, title, text, where }: { href: string; title: string; text: string; where?: string }) {
  return (
    <Link href={href} className="card lift group flex h-full flex-col p-5 sm:p-6">
      <span className="text-lg font-semibold leading-snug group-hover:text-primary">{title}</span>
      <span className="mt-2 text-[0.9375rem] text-muted-foreground">{text}</span>
      <span className="mt-auto flex items-center justify-between gap-4 pt-5">
        <span className="text-sm font-medium">{where}</span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden />
      </span>
    </Link>
  );
}
