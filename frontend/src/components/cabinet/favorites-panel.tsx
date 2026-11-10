"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import { cabinetFetch, type FavoriteItem } from "./api";
import { useCabinetList } from "./use-cabinet-data";

export function FavoritesPanel() {
  const t = useTranslations("cabinet");
  const locale = useLocale();
  const { data, error, mutate } = useCabinetList<FavoriteItem[]>(`/favorites?lang=${locale}`);
  return (
    <section aria-labelledby="fav-title" className="space-y-3">
      <h2 id="fav-title" className="text-xl font-semibold">{t("favorites.title")}</h2>
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      {data?.length === 0 && <p className="text-muted-foreground">{t("favorites.empty")}</p>}
      <ul className="space-y-2">
        {data?.map((item) => (
          <li key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 rounded-md border bg-surface p-3">
            <span className="min-w-0">
              <span className="mr-2 text-xs uppercase text-muted-foreground">{t(`favorites.types.${item.type}`)}</span>
              <Link href={item.href} className="break-words text-primary hover:underline">{item.title}</Link>
              {item.is_demo && <DemoBadge className="ml-2" />}
            </span>
            <button
              type="button"
              aria-label={t("favorites.remove", { title: item.title })}
              onClick={() => mutate(() => cabinetFetch(`/favorites/${item.type}/${item.id}`, { method: "DELETE" }))}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-surface-muted"
            >
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
