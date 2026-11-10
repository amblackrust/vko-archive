import { API_URL } from "./client";
import type { DocumentItem } from "./catalog";

/** Контракты публичного API «Архива памяти» (backend/app/schemas/memory.py). Тексты — plain text. */

export interface MemoryDocument extends DocumentItem {
  note: string;
  /** Путь вида /api/files/{id}/preview; есть только у открытых цифровых копий. */
  preview_url: string | null;
}

export interface SourceRef {
  title: string;
  url: string | null;
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface CollectionItem {
  slug: string;
  href: string;
  title: string;
  title_lang: string;
  theme: string | null;
  period: string | null;
  description: string;
  is_demo: boolean;
  item_count: number;
  translation_missing: boolean;
}

export interface CollectionsResponse {
  items: CollectionItem[];
  themes: FacetCount[];
  periods: FacetCount[];
}

export interface CollectionDetail extends CollectionItem {
  documents: MemoryDocument[];
}

export interface PersonItem {
  slug: string;
  href: string;
  name: string;
  name_lang: string;
  years_text: string | null;
  birth_year: number | null;
  death_year: number | null;
  bio: string;
  sources: SourceRef[];
  is_demo: boolean;
  translation_missing: boolean;
}

export interface PersonDetail extends PersonItem {
  documents: MemoryDocument[];
}

export interface HistoricalEvent {
  slug: string;
  href: string;
  title: string;
  title_lang: string;
  date_text: string | null;
  year: number | null;
  theme: string | null;
  description: string;
  place: string;
  lat: number | null;
  lng: number | null;
  sources: SourceRef[];
  is_demo: boolean;
  translation_missing: boolean;
  documents: MemoryDocument[];
}

export interface EventsResponse {
  items: HistoricalEvent[];
  themes: FacetCount[];
}

async function get<T>(path: string, params: Record<string, string | undefined>): Promise<T | null> {
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  const response = await fetch(`${API_URL}/api/memory/${path}?${query}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`memory/${path}: ${response.status}`);
  return (await response.json()) as T;
}

export async function fetchCollections(lang: string, filters: { q?: string; theme?: string; period?: string }) {
  return (await get<CollectionsResponse>("collections", { lang, ...filters }))!;
}

export const fetchCollection = (slug: string, lang: string) =>
  get<CollectionDetail>(`collections/${encodeURIComponent(slug)}`, { lang });

export async function fetchPersons(lang: string) {
  return (await get<{ items: PersonItem[] }>("persons", { lang }))!.items;
}

export const fetchPerson = (slug: string, lang: string) =>
  get<PersonDetail>(`persons/${encodeURIComponent(slug)}`, { lang });

export async function fetchTimeline(lang: string) {
  return (await get<EventsResponse>("timeline", { lang }))!;
}

export async function fetchMapPoints(lang: string) {
  return (await get<EventsResponse>("map-points", { lang }))!;
}
