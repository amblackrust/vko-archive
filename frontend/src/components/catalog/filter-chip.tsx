import { Plus, X } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

/**
 * Условие поиска чипом-ссылкой: применённое снимается («×»), предложенное добавляется («+»).
 * Состояние живёт в адресе, поэтому чип работает без JS; страница при переходе не прокручивается.
 */
export function FilterChip({ href, label, hint, add }: { href: string; label: string; hint: string; add?: boolean }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={hint}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-2xl border bg-surface px-3.5 py-1 text-sm hover:border-primary hover:text-primary"
    >
      {add && <Plus className="size-3.5 shrink-0" aria-hidden />}
      {label}
      {!add && <X className="size-3.5 shrink-0" aria-hidden />}
    </Link>
  );
}
