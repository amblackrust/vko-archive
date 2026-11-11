"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AiFilters } from "@/lib/api/ai";
import { enumLabel, periodLabel } from "@/components/catalog/labels";

type Kind = "types" | "doc_type" | "period" | "places" | "persons";

/** Чипы условий, которые разобрал парсер запроса; каждый можно снять (тогда поиск выполняется заново). */
export function FilterChips({ filters, onRemove }: { filters: AiFilters; onRemove: (kind: Kind, value: string) => void }) {
  const t = useTranslations("search");
  const tc = useTranslations("catalog");
  const chips: { kind: Kind; value: string; label: string }[] = [
    ...filters.types.map((v) => ({ kind: "types" as const, value: v, label: `${t("filters.type")}: ${t.has(`groups.${v}`) ? t(`groups.${v}`) : v}` })),
    ...filters.doc_type.map((v) => ({ kind: "doc_type" as const, value: v, label: `${t("filters.docType")}: ${enumLabel(tc, "docTypes", v)}` })),
    ...filters.period.map((v) => ({ kind: "period" as const, value: v, label: `${t("filters.period")}: ${periodLabel(tc, v)}` })),
    ...filters.places.map((v) => ({ kind: "places" as const, value: v, label: `${t("filters.place")}: ${filters.place_labels?.[v] ?? v}` })),
    ...filters.persons.map((v) => ({ kind: "persons" as const, value: v, label: `${t("filters.person")}: ${v}` })),
  ];
  if (chips.length === 0) return null;
  return (
    <ul aria-label={t("filters.applied")} className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={`${chip.kind}:${chip.value}`}>
          <button
            type="button"
            onClick={() => onRemove(chip.kind, chip.value)}
            aria-label={t("filters.remove", { name: chip.label })}
            className="inline-flex items-center gap-1 rounded-full border bg-accent-soft px-3 py-1 text-sm text-accent-soft-foreground hover:opacity-80"
          >
            {chip.label}
            <X className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
