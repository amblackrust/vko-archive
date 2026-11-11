import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  /** Без href — текущая страница. */
  href?: string;
}

/**
 * Хлебные крошки; «Главная» добавляется автоматически. Последний элемент — текущая страница.
 * `bare` — без собственного контейнера (внутри PageHeader).
 */
export function Breadcrumbs({ items, bare = false }: { items: Crumb[]; bare?: boolean }) {
  const t = useTranslations("common");
  const all: Crumb[] = [{ label: t("home"), href: "/" }, ...items];
  return (
    <nav aria-label={t("breadcrumbs")} className={cn("caps text-sm", !bare && "container-page pt-6")}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
        {all.map((crumb, i) => {
          const last = i === all.length - 1;
          return (
            <li key={i} className="flex min-w-0 items-center gap-2">
              {crumb.href && !last ? (
                <Link href={crumb.href} className="transition-colors hover:text-accent">{crumb.label}</Link>
              ) : (
                <span aria-current="page" className="truncate text-foreground">{crumb.label}</span>
              )}
              {!last && <span aria-hidden className="text-border">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
