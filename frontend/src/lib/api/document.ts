import { PUBLIC_API_URL } from "./client";
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
  return `${PUBLIC_API_URL}${path}`;
}
