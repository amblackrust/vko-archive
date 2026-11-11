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
  /** Путь превью первого файла, открытого анониму (/api/files/{id}?variant=preview), иначе null. */
  preview_url?: string | null;
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
  branch_id: string | null;
  /** Названия фондообразователя по порядку; последнее совпадает с title. */
  former_names: { dates: string | null; name: string }[];
  units_count: number | null;
  category: number | null;
  ownership: "state" | "private" | null;
  first_received: string | null;
  /** "partial" — часть единиц хранения ограничена в доступе (число не публикуется). */
  restricted: string | null;
  source: string | null;
}

export interface NewspaperItem {
  id: string;
  title: string;
  publisher: string | null;
  year_from: number;
  year_to: number;
  volumes_total: number;
  years: { year: number; volumes: number; note: string | null }[];
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

/** `branch` — филиал, где хранится фонд (только если он опубликован). */
export type FundDetail = FundItem & { inventories: InventoryItem[]; branch?: { name: string; href: string } | null };
export type InventoryDetail = InventoryItem & { cases: List<CaseItem> };
export type CaseDetail = CaseItem & { documents: List<DocumentItem> };

export type SearchParams = Record<string, string | string[] | undefined>;

/** Параметры фильтров каталога (повторяемые — списки); всё прочее из URL отбрасывается. */
const LIST_FILTERS = ["period", "topic", "doc_type", "branch_id", "fund_type", "language"] as const;
const TEXT_FILTERS = [
  "q", "title", "fund_number", "inventory_number", "case_number", "year", "date_from", "date_to",
  "author", "place", "keyword", "category", "has_digital_copy",
] as const;
export const SORTS = ["relevance", "date_asc", "date_desc", "code", "title"] as const;

const first = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

/** Фильтры, сортировка и страница из searchParams страницы -> query для API и ссылок; пустые поля отбрасываются. */
export function catalogParams(searchParams: SearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of LIST_FILTERS) {
    const raw = searchParams[key];
    for (const value of Array.isArray(raw) ? raw : raw ? [raw] : []) if (value) out.append(key, value);
  }
  for (const key of [...TEXT_FILTERS, "sort", "view", "page"]) {
    const value = first(searchParams[key]);
    if (value) out.set(key, value);
  }
  return out;
}

/** Адрес страницы с условиями; без условий — без «?» на конце. */
export function withQuery(pathname: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** GET-форма без JS отправляет и пустые поля: такой адрес страница каталога заменяет коротким. */
export function hasBlankParams(searchParams: SearchParams): boolean {
  return Object.values(searchParams).some((raw) => [raw].flat().includes(""));
}

/** Копия query без ключа целиком или без одного значения списка (`value`); номер страницы сбрасывается. */
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

export const FUND_SORTS = ["number", "title", "year"] as const;

/** Как catalogFetch, но сбой сети или API не роняет страницу: undefined -> страница показывает UnavailableState. */
export function catalogLoad<T>(...args: Parameters<typeof catalogFetch>): Promise<T | null | undefined> {
  return catalogFetch<T>(...args).catch(() => undefined);
}

/** Список каталога: при 422 (мусор в параметрах адреса) — тот же список без условий; undefined — API недоступен. */
export async function catalogList<T>(path: string, params: URLSearchParams, lang: string): Promise<T | undefined> {
  const data = await catalogLoad<T>(path, params, lang);
  return data === null ? ((await catalogLoad<T>(path, new URLSearchParams(), lang)) ?? undefined) : data;
}

/** Параметры списков иерархии и фондов из URL страницы; остальное отбрасывается. */
export function listPage(searchParams: SearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of ["q", "page", "type", "year", "category", "sort"]) {
    const value = first(searchParams[key]);
    if (value) out.set(key, value);
  }
  return out;
}
