import { API_URL } from "./client";
import type { FacetValue } from "./catalog";

/** Контракты GET /api/search (backend/app/schemas/search.py). */

/** Типы результатов в порядке вкладок страницы поиска. */
export const SEARCH_TYPES = ["document", "fund", "collection", "exhibition", "news", "page", "branch"] as const;

export interface SearchItem {
  type: string;
  id: string;
  /** Plain text. */
  title: string;
  lang: string;
  /** Экранированный HTML с <mark> — единственное поле, которое допустимо вставлять как HTML. */
  snippet: string;
  /** Путь сайта без локали. */
  href: string;
  document: {
    archive_code: string | null;
    date_text: string | null;
    doc_type: string | null;
    file_access: "open" | "restricted" | "closed" | "needs_review";
    has_digital_copy: boolean;
  } | null;
}

export interface SearchGroup {
  type: string;
  total: number;
  items: SearchItem[];
}

export interface SearchResponse {
  groups: SearchGroup[];
  /** `type` — число результатов каждого типа по запросу, независимо от выбранной вкладки. */
  facets: { type: FacetValue[] };
  /** false — смысловой поиск недоступен, найдено только по словам. */
  semantic: boolean;
}

/** Поиск для серверного рендера страницы; undefined — API недоступен. */
export async function fetchSearch(params: URLSearchParams): Promise<SearchResponse | undefined> {
  try {
    const response = await fetch(`${API_URL}/api/search?${params}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as SearchResponse) : undefined;
  } catch {
    return undefined;
  }
}
