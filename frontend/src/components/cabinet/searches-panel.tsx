"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { cabinetFetch, type SearchEntry } from "./api";
import { useCabinetList } from "./use-cabinet-data";

/** История поиска: запрос запоминается через форму и открывает обычный поиск; очистка — одной кнопкой. */
export function SearchesPanel() {
  const t = useTranslations("cabinet");
  const router = useRouter();
  const { data, error, mutate } = useCabinetList<SearchEntry[]>("/searches");
  return (
    <section aria-labelledby="search-title" className="space-y-3">
      <h2 id="search-title" className="text-xl font-semibold">{t("searches.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("searches.hint")}</p>
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
          if (!query) return;
          await mutate(() => cabinetFetch("/searches", { method: "POST", body: { query } }));
          router.push(`/search?q=${encodeURIComponent(query)}`);
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("searches.queryLabel")}
          <input name="q" required maxLength={200} className="h-10 rounded-md border bg-background px-3 font-normal" />
        </label>
        <Button type="submit">{t("searches.go")}</Button>
      </form>
      {data?.length === 0 && <p className="text-muted-foreground">{t("searches.empty")}</p>}
      <ul className="space-y-1">
        {data?.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-2 rounded-md border bg-surface px-3 py-1.5">
            <Link href={entry.href} className="break-all text-primary hover:underline">{entry.query}</Link>
            <button
              type="button"
              aria-label={t("searches.removeOne", { query: entry.query })}
              onClick={() => mutate(() => cabinetFetch(`/searches/${entry.id}`, { method: "DELETE" }))}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-surface-muted"
            >
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {data && data.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => mutate(() => cabinetFetch("/searches", { method: "DELETE" }))}>
          {t("searches.clear")}
        </Button>
      )}
    </section>
  );
}
