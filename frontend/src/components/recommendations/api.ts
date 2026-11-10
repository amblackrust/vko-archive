import { API_URL } from "@/lib/api/client";

/** Контракт «Похожих материалов» (backend: GET /api/ai/recommendations, schemas/recommendations.py). */

export type RecommendationSourceType = "document" | "exhibition" | "collection" | "news" | "fund";
export type RecommendationObjectType = RecommendationSourceType | "page" | "branch";

export interface RecommendationItem {
  type: RecommendationObjectType;
  id: string;
  /** Plain text. */
  title: string;
  title_lang: string;
  /** Путь сайта без локали; строит сервер. */
  href: string;
  /** Plain text, до ~200 символов. */
  summary: string;
  document: { archive_code: string | null; date_text: string | null; file_access: string } | null;
}

export interface RecommendationsResponse {
  method: "vector" | "fallback";
  personal: boolean;
  items: RecommendationItem[];
}

export interface RecommendationQuery {
  type: RecommendationSourceType;
  id: string;
  lang: string;
  /** Типы рекомендуемых объектов; по умолчанию — тот же тип, что у источника. */
  types?: RecommendationObjectType[];
  /** Недавно просмотренные документы (только при включённых персональных рекомендациях). */
  seen?: string[];
  limit?: number;
}

export async function fetchRecommendations(query: RecommendationQuery, signal?: AbortSignal): Promise<RecommendationsResponse> {
  const params = new URLSearchParams({ type: query.type, id: query.id, lang: query.lang });
  if (query.limit) params.set("limit", String(query.limit));
  for (const type of query.types ?? []) params.append("types", type);
  for (const id of query.seen ?? []) params.append("seen", id);
  const response = await fetch(`${API_URL}/api/ai/recommendations?${params}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`recommendations: HTTP ${response.status}`);
  return (await response.json()) as RecommendationsResponse;
}
