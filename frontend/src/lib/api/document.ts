import { API_URL } from "./client";
import type { DocumentItem } from "./catalog";

/** Контракты карточки документа (backend/app/schemas/catalog.py: DocumentDetail). */

export interface DocumentFile {
  id: string;
  position: number;
  mime: string;
  pages: number | null;
  /** Путь вида /api/files/{id}; полный адрес — через fileUrl(). */
  url: string;
  preview_url: string | null;
  caption: string;
  ocr_text: string | null;
}

export interface TagRef {
  id: string;
  name: string;
  href: string;
}

/** Утверждённая сотрудником аннотация ИИ («Кратко о документе»). */
export interface DocumentAnnotation {
  text: string;
  lang: string;
  label: string;
}

export interface DocumentDetail extends DocumentItem {
  historical_note: string;
  summary: string;
  storage_location: string | null;
  access_conditions: string;
  branch: string | null;
  tags: TagRef[];
  files: DocumentFile[];
  related: DocumentItem[];
  annotation: DocumentAnnotation | null;
}

/** Абсолютный адрес файла для браузера: файлы отдаёт только backend (/api/files/{id}). */
export function fileUrl(path: string): string {
  return `${API_URL}${path}`;
}

/** Результат подсказок для пустой выдачи: похожие документы из /api/search. */
export interface SimilarDocument {
  id: string;
  title: string;
  href: string;
}

export async function similarDocuments(query: string, lang: string): Promise<SimilarDocument[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({ q: query, lang, per_group: "3", log: "false" });
  params.append("types", "document");
  try {
    const response = await fetch(`${API_URL}/api/search?${params}`, { cache: "no-store" });
    if (!response.ok) return [];
    const body = (await response.json()) as { groups: { items: SimilarDocument[] }[] };
    return body.groups.flatMap((group) => group.items).slice(0, 3);
  } catch {
    // Подсказки необязательны: без поиска пустая выдача всё равно показывается.
    return [];
  }
}
