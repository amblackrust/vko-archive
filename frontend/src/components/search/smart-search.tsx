"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/state-view";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { useAnswer } from "@/components/ai/chat/use-answer";
import type { AiFilters, AiMeta } from "@/lib/api/ai";
import { fetchSearch, type SearchGroup, type SearchResponse } from "@/lib/api/search";
import { AiSummary } from "./ai-summary";
import { FilterChips } from "./filter-chips";
import { ResultGroups } from "./result-groups";

type SearchState =
  | { status: "idle" | "loading" | "error" }
  | { status: "done"; data: SearchResponse };

const PAGE_SIZE = 10;

function catalogHref(filters: AiFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  filters.doc_type.forEach((v) => params.append("doc_type", v));
  filters.period.forEach((v) => params.append("period", v));
  const query = params.toString();
  return query ? `/catalog?${query}` : "/catalog";
}

/**
 * Умный поиск: запрос уходит в ИИ-поток; событие meta приносит разобранные фильтры (чипы),
 * по ним выполняется /api/search, а текст справки дописывается рядом. Без ИИ (лимит, сбой)
 * остаётся обычный поиск по тексту запроса.
 */
export function SmartSearch({ query }: { query: string }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const [filters, setFilters] = useState<AiFilters | null>(null);
  const [skipSearch, setSkipSearch] = useState(false);
  const [search, setSearch] = useState<SearchState>({ status: "loading" });
  const [extra, setExtra] = useState<Record<string, SearchGroup["items"]>>({});
  const [loadingMore, setLoadingMore] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const filtersSet = useRef(false);

  const onMeta = useCallback((meta: AiMeta) => {
    filtersSet.current = true;
    setFilters(meta.filters);
    setSkipSearch(meta.mode === "off_topic" || meta.mode === "empty");
  }, []);
  const { state: answer, ask } = useAnswer(locale, onMeta);

  useEffect(() => {
    let cancelled = false;
    void ask(query).then((final) => {
      // Лимит или сбой ИИ до meta: фильтров нет, ищем обычным поиском по тексту запроса.
      if (!cancelled && !filtersSet.current && (final.status === "rateLimited" || final.status === "error")) {
        setFilters({ q: query, types: [], doc_type: [], period: [], places: [], persons: [] });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ask, query]);

  const searchKey = filters && !skipSearch ? JSON.stringify([filters.q, filters.types, filters.doc_type, filters.period]) : "";
  useEffect(() => {
    if (!filters || skipSearch) return;
    const controller = new AbortController();
    setSearch({ status: "loading" });
    setExtra({});
    fetchSearch(
      { q: filters.q || query, lang: locale, types: filters.types, doc_type: filters.doc_type, period: filters.period, per_group: 5 },
      controller.signal,
    )
      .then((data) => setSearch({ status: "done", data }))
      .catch(() => {
        if (!controller.signal.aborted) setSearch({ status: "error" });
      });
    return () => controller.abort();
    // searchKey — состав фильтров; сам объект filters меняется и при смене только places/persons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, retry]);

  function removeChip(kind: "types" | "doc_type" | "period" | "places" | "persons", value: string) {
    setFilters((current) => {
      if (!current) return current;
      const next = { ...current, [kind]: current[kind].filter((v) => v !== value) };
      // Место и имя в /api/search идут только текстом запроса — убираем слово из q.
      if (kind === "places" || kind === "persons") {
        next.q = current.q.replace(value, " ").replace(/\s+/g, " ").trim();
      }
      return next;
    });
  }

  async function loadMore(type: string) {
    if (!filters || search.status !== "done") return;
    const group = search.data.groups.find((g) => g.type === type);
    if (!group) return;
    setLoadingMore(type);
    try {
      const shown = group.items.length + (extra[type]?.length ?? 0);
      const data = await fetchSearch(
        { q: filters.q || query, lang: locale, types: [type], doc_type: filters.doc_type, period: filters.period, per_group: PAGE_SIZE, offset: shown, log: false },
        new AbortController().signal,
      );
      const items = data.groups.find((g) => g.type === type)?.items ?? [];
      setExtra((prev) => ({ ...prev, [type]: [...(prev[type] ?? []), ...items] }));
    } catch {
      setSearch({ status: "error" });
    } finally {
      setLoadingMore(null);
    }
  }

  const groups: SearchGroup[] =
    search.status === "done"
      ? search.data.groups.map((g) => ({ ...g, items: [...g.items, ...(extra[g.type] ?? [])] }))
      : [];

  return (
    <div className="space-y-6">
      {filters && <FilterChips filters={filters} onRemove={removeChip} />}
      <AiSummary state={answer} />

      <div aria-live="polite" className="space-y-4">
        {skipSearch && <p className="text-sm text-muted-foreground">{t("ai.hiddenOffTopic")}</p>}
        {!skipSearch && search.status === "loading" && (
          <p role="status" className="text-sm text-muted-foreground">
            {filters ? t("searching") : t("analyzing")}
          </p>
        )}
        {search.status === "error" && (
          <div role="alert" className="space-y-2">
            <p>{t("searchError")}</p>
            <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>{t("retry")}</Button>
          </div>
        )}
        {search.status === "done" && (
          <>
            <p className="text-sm text-muted-foreground">
              {t("total", { count: search.data.total })}
              {!search.data.semantic && `. ${t("noVector")}`}
            </p>
            {groups.length === 0 ? (
              <>
                <EmptyState as="h2" />
                <p className="text-center text-sm text-muted-foreground">{t("empty.description")}</p>
              </>
            ) : (
              <ResultGroups groups={groups} loadingMore={loadingMore} onMore={loadMore} />
            )}
          </>
        )}
      </div>

      {filters && !skipSearch && (
        <p>
          <Button asChild variant="outline">
            <Link href={catalogHref(filters)}>{t("openInCatalog")}</Link>
          </Button>
        </p>
      )}
    </div>
  );
}
