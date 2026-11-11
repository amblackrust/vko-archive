import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export interface Crumb {
  label: string;
  /** Без href — текущая страница. */
  href?: string;
}

/** Хлебные крошки; «Главная» добавляется автоматически. Последний элемент — текущая страница. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = useTranslations("common");
  const all: Crumb[] = [{ label: t("home"), href: "/" }, ...items];
  return (
    <nav aria-label={t("breadcrumbs")} className="container-page py-3 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
        {all.map((crumb, i) => {
          const last = i === all.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {crumb.href && !last ? (
                <Link href={crumb.href} className="hover:text-foreground hover:underline">{crumb.label}</Link>
              ) : (
                <span aria-current="page" className="text-foreground">{crumb.label}</span>
              )}
              {!last && <ChevronRight className="size-3.5" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
