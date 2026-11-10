"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RateLimitedError, streamAnswer, type AiMeta, type AiResult } from "@/lib/api/ai";

export type AnswerState =
  | { status: "idle" }
  | { status: "loading"; text: string; meta: AiMeta | null }
  | { status: "done"; result: AiResult }
  | { status: "rateLimited"; retryAfter: number | null }
  | { status: "error" }
  | { status: "stopped"; text: string };

/**
 * Один потоковый ответ ИИ за раз. Во время стрима растёт text; в done он заменяется итогом сервера
 * (пост-проверенным; при mode=unavailable — текстом о недоступности). Новый запрос отменяет предыдущий.
 */
export function useAnswer(lang: string, onMeta?: (meta: AiMeta) => void) {
  const [state, setState] = useState<AnswerState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);
  const textRef = useRef("");
  const onMetaRef = useRef(onMeta);
  useEffect(() => {
    onMetaRef.current = onMeta;
  });

  const cancel = useCallback(() => controller.current?.abort(), []);

  const ask = useCallback(
    async (question: string): Promise<AnswerState> => {
      controller.current?.abort();
      const own = new AbortController();
      controller.current = own;
      textRef.current = "";
      setState({ status: "loading", text: "", meta: null });
      let final: AnswerState;
      try {
        const result = await streamAnswer(
          question,
          lang,
          {
            onMeta: (meta) => {
              onMetaRef.current?.(meta);
              setState((s) => (s.status === "loading" ? { ...s, meta } : s));
            },
            onDelta: (text) => {
              textRef.current += text;
              setState((s) => (s.status === "loading" ? { ...s, text: s.text + text } : s));
            },
          },
          own.signal,
        );
        final = { status: "done", result };
      } catch (error) {
        final = own.signal.aborted
          ? { status: "stopped", text: textRef.current }
          : error instanceof RateLimitedError ? { status: "rateLimited", retryAfter: error.retryAfter } : { status: "error" };
      }
      if (controller.current === own) setState(final);
      return final;
    },
    [lang],
  );

  useEffect(() => () => controller.current?.abort(), []);

  return { state, ask, cancel };
}
