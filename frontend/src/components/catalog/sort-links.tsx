import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { SORTS } from "@/lib/api/catalog";
import { cn } from "@/lib/utils";

/** Переключатель сортировки ссылками; фильтры сохраняются, страница сбрасывается. */
export function SortLinks({ params, active }: { params: URLSearchParams; active: string }) {
  const t = useTranslations("catalog.sort");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t("label")}:</span>
      {SORTS.map((sort) => {
        const next = new URLSearchParams(params);
        next.delete("page");
        next.set("sort", sort);
        return (
          <Link
            key={sort}
            href={`/catalog?${next}`}
            aria-current={sort === active ? "true" : undefined}
            className={cn("rounded-md px-2 py-1", sort === active ? "bg-primary text-primary-foreground" : "hover:bg-surface-muted")}
          >
            {t(sort)}
          </Link>
        );
      })}
    </div>
  );
}
