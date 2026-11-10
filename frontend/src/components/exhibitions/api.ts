import { API_URL } from "@/lib/api/client";

/** Контракты backend/app/schemas/exhibitions.py и news.py. Тексты — plain text; файлы — только /api/files. */

export interface MediaRef {
  url: string;
  preview_url: string | null;
  mime: string;
}

export interface ExhibitionItem {
  id: string;
  slug: string;
  href: string;
  title: string;
  title_lang: string;
  theme: string | null;
  period: string | null;
  intro: string;
  cover: MediaRef | null;
  exhibits_count: number;
  is_demo: boolean;
  translation_status: string;
}

export interface ExhibitionList {
  total: number;
  items: ExhibitionItem[];
  themes: string[];
  periods: string[];
}

export interface Exhibit {
  id: string;
  position: number;
  title: string;
  caption: string;
  source: string;
  archive_code: string | null;
  media: MediaRef | null;
  video_url: string | null;
  document_href: string | null;
  is_demo: boolean;
}

export interface ExhibitionDetail extends ExhibitionItem {
  exhibits: Exhibit[];
}

/** Возвращает null на 404; при сетевой ошибке или 5xx бросает исключение. */
export async function fetchPublic<T>(path: string, params: URLSearchParams, lang: string): Promise<T | null> {
  const query = new URLSearchParams(params);
  query.set("lang", lang);
  const response = await fetch(`${API_URL}/api/${path}?${query}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
}
