"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { Branch, BranchType } from "@/lib/api/branches";
import { cn } from "@/lib/utils";
import { BranchCard } from "./branch-card";
import { BranchMap } from "./branch-map-loader";

const types: (BranchType | "all")[] = ["all", "head", "district", "city", "personnel"];

/** Карта + список + поиск/фильтр + карточка выбранного филиала. Список и карточка работают и без карты. */
export function BranchesExplorer({ branches }: { branches: Branch[] }) {
  const t = useTranslations("map");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<BranchType | "all">("all");
  const [selected, setSelected] = useState<string | undefined>();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return branches.filter(
      (b) =>
        (type === "all" || b.type === type) &&
        (!needle || `${b.name} ${b.address}`.toLowerCase().includes(needle)),
    );
  }, [branches, query, type]);
  const current = branches.find((b) => b.slug === selected);

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-3">
        <div className="relative">
          <label htmlFor="branch-q" className="sr-only">{t("search.label")}</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="branch-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search.placeholder")} className="pl-9" />
        </div>
        <div role="group" aria-label={t("filter.label")} className="flex flex-wrap gap-2">
          {types.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={type === value}
              onClick={() => setType(value)}
              className={cn(
                "min-h-9 rounded-full border px-3 text-sm",
                type === value ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-surface-muted",
              )}
            >
              {t(`types.${value}`)}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground" role="status">{t("count", { count: visible.length })}</p>
        {visible.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm">{t("empty")}</p>
        ) : (
          <ul className="max-h-[28rem] divide-y overflow-y-auto rounded-lg border bg-surface">
            {visible.map((b) => (
              <li key={b.slug}>
                <button
                  type="button"
                  onClick={() => setSelected(b.slug)}
                  aria-pressed={b.slug === selected}
                  className={cn("block w-full px-3 py-2.5 text-left hover:bg-surface-muted", b.slug === selected && "bg-accent-soft")}
                >
                  <span className="block text-sm font-medium">{b.name}</span>
                  <span className="block text-xs text-muted-foreground">{b.address || t("card.pending")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="min-w-0 space-y-4">
        <div className="h-[22rem] overflow-hidden rounded-lg border sm:h-[28rem]">
          <BranchMap
            branches={visible}
            selected={selected}
            onSelect={setSelected}
            label={t("map.label")}
            tileErrorText={t("map.tilesFailed")}
          />
        </div>
        {current ? (
          <BranchCard branch={current} locale={locale} headingLevel={3} showDetailsLink />
        ) : (
          <p className="rounded-lg border bg-surface-muted p-4 text-sm text-muted-foreground">{t("selectHint")}</p>
        )}
      </div>
    </div>
  );
}
