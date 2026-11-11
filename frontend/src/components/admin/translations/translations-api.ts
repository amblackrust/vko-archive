import { adminRequest } from "@/lib/api/admin";

/** Контракты /api/admin/translations (backend/app/schemas/translations.py). */
export const TRANSLATION_LANGS = ["kk", "ru", "en"] as const;
export type TranslationLang = (typeof TRANSLATION_LANGS)[number];
export type TranslationStatus = "verified" | "machine" | "missing";

export const TRANSLATION_OBJECT_TYPES = [
  "document", "fund", "inventory", "case", "branch", "news", "page", "faq", "legal_act",
  "price_list_item", "memorial_date", "exhibition", "exhibit", "collection", "person", "historical_event",
] as const;

export interface TranslationItem {
  object_type: string;
  id: string;
  label: string;
  workflow_status: string;
  version: number;
  translation_status: Record<TranslationLang, TranslationStatus>;
}

export interface TranslationDetail extends TranslationItem {
  /** Переводимые поля: имя → {kk, ru, en}. */
  fields: Record<string, Partial<Record<TranslationLang, string>>>;
  can_machine_translate: boolean;
}

export interface TranslationPage {
  items: TranslationItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface MachineTranslateInput {
  objectType: string;
  objectId: string;
  version: number;
  source: TranslationLang;
  target: TranslationLang;
  overwrite?: boolean;
}

export const translationsApi = {
  list: (params: { object_type: string; lang?: string; status?: string; q?: string; page: number; page_size: number }) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
    return adminRequest<TranslationPage>(`/translations?${search}`);
  },
  get: (objectType: string, objectId: string) =>
    adminRequest<TranslationDetail>(`/translations/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`),
  /** 503 ai_unavailable — Ollama недоступна (AdminApiError.code = "ai_unavailable"). */
  machine: ({ objectType, objectId, version, source, target, overwrite }: MachineTranslateInput) =>
    adminRequest<TranslationDetail>(`/translations/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}/machine`, {
      method: "POST",
      body: { source_lang: source, target_lang: target, version, overwrite: overwrite ?? false },
    }),
  /** Черновой перевод одной строки без сохранения (формы настроек сайта). 503 ai_unavailable — Ollama недоступна. */
  text: (text: string, source: TranslationLang, target: TranslationLang) =>
    adminRequest<{ text: string }>("/translations/text", {
      method: "POST",
      body: { text, source_lang: source, target_lang: target },
    }),
  verify: (objectType: string, objectId: string, lang: TranslationLang, version: number) =>
    adminRequest<TranslationDetail>(`/translations/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}/verify`, {
      method: "POST",
      body: { lang, version },
    }),
};
