import type { MediaRef } from "@/components/exhibitions/api";

/** Контракты backend/app/schemas/news.py. `body` — HTML, очищенный на сервере (services/sanitize). */

export type { MediaRef };

export interface NewsItem {
  id: string;
  slug: string;
  href: string;
  title: string;
  title_lang: string;
  summary: string;
  category: string | null;
  published_at: string | null;
  cover: MediaRef | null;
  is_demo: boolean;
  translation_status: string;
}

export interface NewsList {
  total: number;
  page: number;
  pages: number;
  items: NewsItem[];
  categories: string[];
}

export interface NewsDetail extends NewsItem {
  body: string;
  body_lang: string;
  media: { file: MediaRef | null; url: string | null }[];
  related: { type: "document" | "exhibition" | "news"; id: string; title: string; href: string }[];
}

/** Дата публикации в UTC (в БД лежит полночь по UTC), чтобы сервер и браузер показывали одно число. */
export function formatPublished(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
