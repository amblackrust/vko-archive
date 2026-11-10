import { API_URL } from "./client";

/** Контракты GET /api/search (backend/app/schemas/search.py). */

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
    file_access: string;
    has_digital_copy: boolean;
  } | null;
}

export interface SearchGroup {
  type: string;
  total: number;
  items: SearchItem[];
}

export interface SearchResponse {
  total: number;
  groups: SearchGroup[];
  semantic: boolean;
}

export interface SearchQuery {
  q: string;
  lang: string;
  types?: string[];
  doc_type?: string[];
  period?: string[];
  per_group?: number;
  offset?: number;
  log?: boolean;
}

export async function fetchSearch(query: SearchQuery, signal: AbortSignal): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query.q, lang: query.lang });
  for (const key of ["types", "doc_type", "period"] as const) {
    for (const value of query[key] ?? []) params.append(key, value);
  }
  if (query.per_group) params.set("per_group", String(query.per_group));
  if (query.offset) params.set("offset", String(query.offset));
  if (query.log === false) params.set("log", "false");
  const response = await fetch(`${API_URL}/api/search?${params}`, { signal });
  if (!response.ok) throw new Error(`search ${response.status}`);
  return response.json();
}
