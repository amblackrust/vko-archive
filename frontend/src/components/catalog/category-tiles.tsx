import { Archive, Camera, FileText, Landmark, Map, Music, UserRound, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import type { FacetValue } from "@/lib/api/catalog";
import { cn } from "@/lib/utils";

const icons: Record<string, LucideIcon> = {
  historical: Archive,
  photos: Camera,
  maps: Map,
  written: FileText,
  organizations: Landmark,
  personal: UserRound,
  audio_video: Music,
};

/** Вход в каталог по категориям ТЗ §5.3 (категория — обычный фильтр `category` в URL). */
export function CategoryTiles({ counts, active }: { counts: FacetValue[]; active?: string }) {
  const t = useTranslations("catalog.categories");
  return (
    <section aria-labelledby="catalog-categories">
      <h2 id="catalog-categories" className="sr-only">{t("title")}</h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {counts.map(({ value, count }) => {
          const Icon = icons[value] ?? Archive;
          const selected = value === active;
          return (
            <li key={value} className="min-w-0">
              <Link
                href={selected ? "/catalog" : `/catalog?category=${value}`}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex h-full items-center gap-3 rounded-lg border p-3 text-sm",
                  selected ? "border-primary bg-accent-soft" : "bg-surface hover:bg-surface-muted",
                )}
              >
                <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 break-words font-medium">{t(value)}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
