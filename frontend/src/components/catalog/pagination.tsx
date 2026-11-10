import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

interface PaginationProps {
  pathname: string;
  params: URLSearchParams;
  page: number;
  pages: number;
}

function pageHref(pathname: string, params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  if (page > 1) next.set("page", String(page));
  else next.delete("page");
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Постраничная навигация ссылками (страница живёт в URL, фильтры сохраняются). */
export function Pagination({ pathname, params, page, pages }: PaginationProps) {
  const t = useTranslations("catalog.results");
  if (pages <= 1) return null;
  const window = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pages || Math.abs(p - page) <= 2,
  );
  const link = "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm";
  return (
    <nav aria-label={t("pagination")} className="mt-6 flex flex-wrap items-center justify-center gap-1">
      {page > 1 && (
        <Link href={pageHref(pathname, params, page - 1)} rel="prev" className={cn(link, "gap-1 bg-surface hover:bg-surface-muted")}>
          <ChevronLeft className="size-4" aria-hidden />
          {t("prev")}
        </Link>
      )}
      {window.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - window[i - 1] > 1 && <span aria-hidden>…</span>}
          <Link
            href={pageHref(pathname, params, p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(link, p === page ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-surface-muted")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link href={pageHref(pathname, params, page + 1)} rel="next" className={cn(link, "gap-1 bg-surface hover:bg-surface-muted")}>
          {t("next")}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </nav>
  );
}
