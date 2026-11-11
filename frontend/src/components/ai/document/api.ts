import { readNdjson } from "@/lib/api/ai";
import { API_URL } from "@/lib/api/client";

/** Контракт режима «ИИ по документу» (backend: POST /api/ai/documents/{id}/answer/stream, schemas/ai.py). */

export type DocumentAiMode = "answer" | "not_found" | "restricted" | "off_topic" | "service" | "unavailable" | "empty";

export interface DocumentAiSource {
  /** Метка в тексте ответа: «S3» → «[S3]». */
  ref: string;
  type: string;
  title: string;
  /** Путь сайта без локали; строит сервер. */
  href: string | null;
  /** Лист цифровой копии, из которого взят фрагмент (null — описание документа или раздел сайта). */
  page: number | null;
  file_id: string | null;
  access_conditions: string | null;
}

export interface DocumentAiResult {
  mode: DocumentAiMode;
  ai_available: boolean;
  /** «Сформировано ИИ, не является архивной справкой» — только когда текст писала модель. */
  label: string | null;
  /** Plain text: показывать только как текст, метки [Sn] заменять по sources. */
  answer: string;
  sources: DocumentAiSource[];
  links: { id: "egov" | "eotinish"; url: string }[];
}

export class RateLimitedError extends Error {
  constructor(readonly retryAfter: number | null) {
    super("rate_limited");
  }
}

/** Доступна ли модель (GET /api/ai/status). При ошибке сети — считаем недоступной. */
export async function aiAvailable(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/ai/status`, { cache: "no-store", signal });
    if (!response.ok) return false;
    return ((await response.json()) as { ai_available: boolean }).ai_available;
  } catch {
    return false;
  }
}

/**
 * Вопрос о документе потоком (NDJSON: meta → delta* → done). Возвращает итог из done.
 * Если после delta пришёл done с mode=unavailable (модель упала посреди ответа),
 * вызывающий заменяет показанный текст на result.answer.
 */
export async function askDocument(
  documentId: string,
  q: string,
  lang: string,
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<DocumentAiResult> {
  const response = await fetch(`${API_URL}/api/ai/documents/${encodeURIComponent(documentId)}/answer/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q, lang }),
    signal,
  });
  if (response.status === 429) {
    const retry = Number(response.headers.get("Retry-After"));
    throw new RateLimitedError(Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  if (!response.ok || !response.body) throw new Error(`document AI: HTTP ${response.status}`);

  let result: DocumentAiResult | null = null;
  await readNdjson(response.body, (event) => {
    if (event.type === "delta" && event.text) onDelta(event.text as string);
    if (event.type === "done" && event.result) result = event.result as DocumentAiResult;
  });
  if (result === null) throw new Error("document AI: stream ended without result");
  return result;
}
