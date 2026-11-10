import { API_URL } from "./client";

/** Контракты ИИ-помощника (backend/app/schemas/ai.py, роутер /api/ai). */

export type AiMode = "answer" | "not_found" | "restricted" | "off_topic" | "service" | "unavailable" | "empty";

export interface AiFilters {
  q: string;
  types: string[];
  doc_type: string[];
  period: string[];
  places: string[];
  persons: string[];
}

export interface AiSource {
  /** Метка, которой ответ ссылается на карточку: «S1» (в тексте — «[S1]»). */
  ref: string;
  type: string;
  title: string;
  /** Путь сайта без локали; строит сервер. */
  href: string | null;
  url: string | null;
  archive_code: string | null;
  date_text: string | null;
  access: string | null;
  access_conditions: string | null;
  address: string | null;
  phone: string | null;
  hours: string | null;
  routes: { provider: "2gis" | "google" | "yandex"; url: string }[];
}

export interface AiResult {
  mode: AiMode;
  query: string;
  ai_available: boolean;
  ai_generated: boolean;
  label: string | null;
  answer: string;
  sources: AiSource[];
  links: { id: "egov" | "eotinish"; url: string }[];
  filters: AiFilters | null;
  hints: string[];
}

export interface AiMeta {
  mode: AiMode;
  ai_available: boolean;
  filters: AiFilters | null;
}

/** Лимит запросов (429): сколько секунд подождать. */
export class RateLimitedError extends Error {
  constructor(readonly retryAfter: number | null) {
    super("rate_limited");
  }
}

interface StreamHandlers {
  onMeta?: (meta: AiMeta) => void;
  onDelta: (text: string) => void;
}

/**
 * Ответ ИИ потоком (NDJSON: meta → delta* → done). Возвращает итог из события done.
 * Это POST, поэтому fetch + ReadableStream, а не EventSource.
 */
export async function streamAnswer(
  q: string,
  lang: string,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<AiResult> {
  const response = await fetch(`${API_URL}/api/ai/answer/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q, lang }),
    signal,
  });
  if (response.status === 429) {
    const retry = Number(response.headers.get("Retry-After"));
    throw new RateLimitedError(Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  if (!response.ok || !response.body) throw new Error(`ai stream ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AiResult | null = null;

  function handleLine(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "meta") handlers.onMeta?.(event);
    else if (event.type === "delta") handlers.onDelta(event.text);
    else if (event.type === "done") result = event.result;
  }

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handleLine);
  }
  buffer += decoder.decode();
  handleLine(buffer);
  if (!result) throw new Error("ai stream ended without result");
  return result;
}
