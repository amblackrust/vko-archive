import { API_URL } from "./client";

/** Контракты публичного контента (backend/app/schemas/content.py). Все тексты — plain text,
 *  кроме `body` страниц: санитизированный HTML из CMS. `lang` — язык, на котором текст реально показан. */
export interface PageDetail {
  key: string;
  title: string;
  body: string;
  lang: string;
  translation_status: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  lang: string;
  translation_status: string;
}

export interface FaqGroup {
  category: string;
  items: FaqItem[];
}

export interface Phone {
  label: string;
  value: string;
}

export interface Contacts {
  address: string;
  director: string;
  phones: Phone[];
  email: string;
  hours: string;
  reading_room_hours: string;
}

/** GET к публичному контенту; 404 -> null (страница снята с публикации или не существует). */
async function contentFetch<T>(path: string, lang?: string): Promise<T | null> {
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  const response = await fetch(`${API_URL}/api/${path}${query}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`content ${path}: ${response.status}`);
  return (await response.json()) as T;
}

export const fetchPage = (key: string, lang: string) =>
  contentFetch<PageDetail>(`pages/${encodeURIComponent(key)}`, lang);

export const fetchFaqs = async (lang: string): Promise<FaqGroup[]> => {
  const data = await contentFetch<{ groups: FaqGroup[] }>("faqs", lang);
  if (!data) throw new Error("content faqs: 404");
  return data.groups;
};

export const fetchContacts = () => contentFetch<Contacts>("contacts");

/** SEO-поля страницы из админки; пустые — не переопределяют заголовок и описание по умолчанию. */
export const pageSeo = (page: PageDetail | null) => ({
  title: page?.seo_title || page?.title,
  description: page?.seo_description || undefined,
  keywords: page?.seo_keywords || undefined,
});

/** Телефон приёмной (канцелярии) из контактов архива: общий справочный номер для страниц услуг. */
export const receptionPhone = (contacts: Contacts | null) =>
  contacts?.phones.find((phone) => /при[её]мная/i.test(phone.label))?.value ?? null;
