import type { useTranslations } from "next-intl";
import { enumLabel, periodLabel } from "@/components/catalog/labels";
import { withQuery } from "@/lib/api/catalog";

type T = ReturnType<typeof useTranslations>;

/** Фильтры документов на странице поиска (в адресе — как в каталоге). */
export const DOC_FILTERS = ["doc_type", "period"] as const;
export type DocFilter = (typeof DOC_FILTERS)[number];

/** Подпись условия для чипа: «Тип документа: Фотография». `t` — пространство search, `tc` — catalog. */
export function filterLabel(t: T, tc: T, key: DocFilter | "type", value: string): string {
  if (key === "doc_type") return `${t("filters.docType")}: ${enumLabel(tc, "docTypes", value)}`;
  if (key === "period") return `${t("filters.period")}: ${periodLabel(tc, value)}`;
  return `${t("filters.section")}: ${enumLabel(t, "types", value)}`;
}

/** Адрес вкладки типа (null — «Все»). Фильтры документов действуют только на документы и на других вкладках снимаются. */
export function tabHref(current: URLSearchParams, type: string | null): string {
  const next = new URLSearchParams(current);
  next.delete("page");
  if (type) next.set("type", type);
  else next.delete("type");
  if (type !== "document") DOC_FILTERS.forEach((key) => next.delete(key));
  return withQuery("/search", next);
}

/** Адрес с добавленным фильтром документов: вместе с ним включается вкладка «Документы». */
export function addFilterHref(current: URLSearchParams, key: DocFilter, value: string): string {
  const next = new URLSearchParams(current);
  next.delete("page");
  next.set("type", "document");
  next.append(key, value);
  return withQuery("/search", next);
}
