import { API_URL } from "./client";

/** Контракты публичного каталога (backend/app/schemas/catalog.py). Все названия — plain text. */

export interface Ref {
  id: string;
  number: string;
  title: string;
  href: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  title_lang: string;
  href: string;
  archive_code: string | null;
  date_text: string | null;
  doc_type: string | null;
  period: string | null;
  language: string | null;
  authors: string;
  places: string[];
  sheets_count: number | null;
  file_access: "open" | "restricted" | "closed" | "needs_review";
  has_digital_copy: boolean;
  branch_id: string | null;
  is_demo: boolean;
  fund: Ref | null;
  inventory: Ref | null;
  case: Ref | null;
}

export interface FacetValue {
  value: string;
  label: string | null;
  count: number;
}

export interface CatalogFacets {
  doc_type: FacetValue[];
  period: FacetValue[];
  language: FacetValue[];
  branch: FacetValue[];
  topic: FacetValue[];
  fund_type: FacetValue[];
  category: FacetValue[];
  with_digital_copy: number;
}

export interface Pagination {
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface DocumentsResponse extends Pagination {
  items: DocumentItem[];
  facets: CatalogFacets;
  sort: string;
}

export interface FundItem {
  id: string;
  number: string;
  title: string;
  title_lang: string;
  type: string;
  dates_from: number | null;
  dates_to: number | null;
  annotation: string;
  is_demo: boolean;
  inventory_count: number;
  document_count: number;
  href: string;
}

export interface InventoryItem {
  id: string;
  number: string;
  title: string;
  title_lang: string;
  dates_text: string | null;
  is_demo: boolean;
  case_count: number;
  document_count: number;
  href: string;
  fund: Ref;
}

export interface CaseItem {
  id: string;
  number: string;
  title: string;
  title_lang: string;
  dates_text: string | null;
  sheets_count: number | null;
  is_demo: boolean;
  document_count: number;
  href: string;
  inventory: Ref;
  fund: Ref;
}

export interface List<T> extends Pagination {
  items: T[];
}

export type FundDetail = FundItem & { inventories: InventoryItem[] };
export type InventoryDetail = InventoryItem & { cases: List<CaseItem> };
export type CaseDetail = CaseItem & { documents: List<DocumentItem> };

export type SearchParams = Record<string, string | string[] | undefined>;

/** Параметры фильтров каталога (повторяемые — списки); всё прочее из URL отбрасывается. */
export const LIST_FILTERS = ["period", "topic", "doc_type", "branch_id", "fund_type", "language"] as const;
export const TEXT_FILTERS = [
  "q", "title", "fund_number", "inventory_number", "case_number", "year", "date_from", "date_to",
  "author", "place", "keyword", "category", "has_digital_copy",
] as const;
export const SORTS = ["relevance", "date_asc", "date_desc", "code", "title"] as const;

/** Фильтры, сортировка и страница из searchParams страницы -> query для API и ссылок. */
export function catalogParams(searchParams: SearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of LIST_FILTERS) {
    const raw = searchParams[key];
    for (const value of Array.isArray(raw) ? raw : raw ? [raw] : []) if (value) out.append(key, value);
  }
  for (const key of [...TEXT_FILTERS, "sort", "page"]) {
    const raw = searchParams[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) out.set(key, value);
  }
  return out;
}

/** Копия query с изменением (value=null — убрать ключ или одно значение списка). */
export function withoutParam(params: URLSearchParams, key: string, value?: string): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of params) {
    if (k === "page") continue;
    if (k === key && (value === undefined || v === value)) continue;
    out.append(k, v);
  }
  return out;
}

/**
 * GET к каталогу; 404 -> null (материал скрыт или не существует). `session` — значение cookie сессии
 * сотрудника (серверный рендер её сам не передаёт): с ней карточка содержит и закрытые файлы, доступные ему.
 */
export async function catalogFetch<T>(path: string, params: URLSearchParams, lang: string, session?: string): Promise<T | null> {
  const query = new URLSearchParams(params);
  query.set("lang", lang);
  const response = await fetch(`${API_URL}/api/catalog/${path}?${query}`, {
    cache: "no-store",
    headers: session ? { Cookie: `vko_session=${session}` } : undefined,
  });
  if (response.status === 404 || response.status === 422) return null;
  if (!response.ok) throw new Error(`catalog ${path}: ${response.status}`);
  return (await response.json()) as T;
}

export function listPage(searchParams: SearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of ["q", "page", "type"]) {
    const raw = searchParams[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) out.set(key, value);
  }
  return out;
}
