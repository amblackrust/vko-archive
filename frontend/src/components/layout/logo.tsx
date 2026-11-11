import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Знак: вложенные квадраты — архив, фонд, опись, дело и документ в его основании.
 * Рабочий знак прототипа до утверждения официального логотипа заказчиком.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M2 2h36v36H2z" />
      <path d="M2 12h26v26" />
      <path d="M2 22h16v16" />
      <path d="M2 30h8v8H2z" fill="var(--accent)" stroke="none" />
    </svg>
  );
}

/** Знак и официальное наименование в две строки; ссылка на главную. */
export function Logo({ className }: { className?: string }) {
  const t = useTranslations("layout");
  return (
    <Link href="/" aria-label={t("homeLink")} className={cn("flex min-w-0 items-center gap-3", className)}>
      <LogoMark className="size-9 shrink-0 text-primary sm:size-10" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[0.9375rem] font-bold tracking-tight sm:text-base">{t("logo.line1")}</span>
        <span className="block truncate text-xs text-muted-foreground sm:text-[0.8125rem]">{t("logo.line2")}</span>
      </span>
    </Link>
  );
}
