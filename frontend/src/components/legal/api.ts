import { API_URL } from "@/lib/api/client";

/** Контракты backend/app/schemas/legal.py. Названия и тексты — plain text; file.url — путь /api/files. */

export const LEGAL_STATUSES = ["active", "amended", "expired"] as const;
export type LegalActStatus = (typeof LEGAL_STATUSES)[number];

export interface ActFile {
  url: string;
  mime: string;
  pages: number | null;
}

export interface LegalActItem {
  id: string;
  title: string;
  title_lang: string;
  number: string | null;
  date: string | null;
  issuer: string;
  status: LegalActStatus;
  /** Дата последней сверки с официальной публикацией. */
  actualized_at: string | null;
  adilet_url: string | null;
  file: ActFile | null;
}

export interface LegalActsResponse {
  total: number;
  items: LegalActItem[];
}

export interface CompliancePage {
  title: string;
  title_lang: string;
  body: string;
  body_lang: string;
  officer: string | null;
  documents: LegalActItem[];
}

/** Возвращает null на 404; при сетевой ошибке или 5xx бросает исключение. */
export async function legalFetch<T>(path: string, params: URLSearchParams, lang: string): Promise<T | null> {
  const query = new URLSearchParams(params);
  query.set("lang", lang);
  const response = await fetch(`${API_URL}/api/${path}?${query}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`legal ${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** Короткое обозначение формата файла для подписи ссылки; неизвестный тип — пустая строка. */
export const fileFormat = (mime: string) => (mime === "application/pdf" ? "PDF" : mime.includes("wordprocessingml") ? "DOCX" : "");
