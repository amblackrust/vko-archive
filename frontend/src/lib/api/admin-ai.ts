import { adminRequest } from "./admin";

/** Клиент /api/admin/ai-tools и /api/admin/analytics (backend/app/schemas/{ai_tools,analytics}.py). Всё от ИИ — предложения. */

export type AiLang = "kk" | "ru" | "en";
export const AI_LANGS: AiLang[] = ["ru", "kk", "en"];

export interface AiToolsStatus {
  ai_available: boolean;
  reason: string | null;
  ocr_engine: "tesseract" | "vision" | null;
}

export interface DocumentRef {
  id: string;
  title: string;
  archive_code: string | null;
  workflow_status: string;
}
export interface DuplicateRef extends DocumentRef {
  reason: "same_file" | "similar";
  distance: number | null;
}
export interface RelatedRef {
  id: string;
  title: string;
  href: string;
}
export interface Analysis {
  document_id: string;
  version: number;
  lang: AiLang;
  text_chars: number;
  dates: string[];
  persons: string[];
  organizations: string[];
  places: string[];
  events: string[];
  topics: string[];
  tags: { id: string; name: string }[];
  summary: string;
  related: RelatedRef[];
  duplicates: DuplicateRef[];
  label: string;
}
export interface ApplyBody {
  version: number;
  lang: AiLang;
  summary?: string;
  authors?: string;
  date_text?: string;
  places?: string[];
  tag_ids?: string[];
}
export interface OcrProposal {
  file_id: string;
  status: "done" | "failed" | "unavailable";
  engine: string | null;
  reason: string | null;
  text: string;
}
export interface Annotation {
  lang: AiLang;
  text: string;
  status: "draft" | "approved";
  uses_file_text: boolean;
  updated_at: string;
  approved_at: string | null;
  label: string;
}
export interface CollectionDraft {
  title: string;
  description: string;
  items: RelatedRef[];
  label: string;
}

const doc = (id: string) => `/ai-tools/documents/${id}`;

export const aiToolsApi = {
  status: () => adminRequest<AiToolsStatus>("/ai-tools/status"),
  analyze: (id: string, lang: AiLang) => adminRequest<Analysis>(`${doc(id)}/analyze`, { method: "POST", body: { lang } }),
  apply: (id: string, body: ApplyBody) => adminRequest<{ version: number; applied: string[] }>(`${doc(id)}/apply`, { method: "POST", body }),
  ocr: (fileId: string) => adminRequest<OcrProposal>(`/ai-tools/files/${fileId}/ocr`, { method: "POST" }),
  applyOcr: (fileId: string, text: string) =>
    adminRequest<{ file_id: string; ocr_status: string }>(`/ai-tools/files/${fileId}/ocr/apply`, { method: "POST", body: { text } }),
  annotations: (id: string) => adminRequest<Annotation[]>(`${doc(id)}/annotations`),
  generateAnnotation: (id: string, lang: AiLang) =>
    adminRequest<Annotation>(`${doc(id)}/annotations/generate`, { method: "POST", body: { lang } }),
  editAnnotation: (id: string, lang: AiLang, text: string) =>
    adminRequest<Annotation>(`${doc(id)}/annotations/${lang}`, { method: "PUT", body: { text } }),
  approveAnnotation: (id: string, lang: AiLang) => adminRequest<Annotation>(`${doc(id)}/annotations/${lang}/approve`, { method: "POST" }),
  withdrawAnnotation: (id: string, lang: AiLang) => adminRequest<void>(`${doc(id)}/annotations/${lang}`, { method: "DELETE" }),
  draftCollection: (topic: string, lang: AiLang) =>
    adminRequest<CollectionDraft>("/ai-tools/collections/draft", { method: "POST", body: { topic, lang } }),
};

export interface QueryStat {
  query: string;
  count: number;
  avg_results: number;
}
export interface AnalyticsReport {
  days: number;
  total_searches: number;
  zero_result_searches: number;
  zero_result_rate: number;
  by_source: Record<string, number>;
  per_day: { day: string; searches: number; zero_result: number }[];
  top_queries: QueryStat[];
  zero_queries: QueryStat[];
  ai_questions: QueryStat[];
  rare_queries: number;
  stale_pages: { object_type: string; id: string; title: string; updated_at: string }[];
  recommendations: { code: string; params: Record<string, string | number> }[];
  views_available: boolean;
}
export interface AiSummary {
  available: boolean;
  reason: string | null;
  text: string;
  label: string;
}

export const analyticsApi = {
  report: (days: number) => adminRequest<AnalyticsReport>(`/analytics?days=${days}`),
  aiSummary: (days: number, lang: AiLang) => adminRequest<AiSummary>(`/analytics/ai-summary?days=${days}&lang=${lang}`, { method: "POST" }),
};
