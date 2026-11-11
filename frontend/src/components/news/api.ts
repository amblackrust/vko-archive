import type { MediaRef } from "@/components/exhibitions/api";

/** Контракты backend/app/schemas/news.py. `body` — HTML, очищенный на сервере (services/sanitize). */

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

// Главная страница импортирует форматирование даты новости отсюда.
export { formatIsoDate as formatPublished } from "@/lib/dates";
