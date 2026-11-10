"use client";

import { Bot, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnswerText } from "@/components/ai/chat/answer-text";
import { AnswerExtras } from "@/components/ai/chat/source-cards";
import type { AnswerState } from "@/components/ai/chat/use-answer";

/**
 * Блок «ИИ-справка»: стрим растёт в aria-live-регионе, по завершении текст заменяется итогом сервера.
 * Ответ — только plain text; [Sn] — ссылки на карточки-источники. Всегда есть пометка о справочном характере.
 */
export function AiSummary({ state }: { state: AnswerState }) {
  const t = useTranslations("search.ai");
  const ta = useTranslations("ai");
  if (state.status === "idle") return null;

  const result = state.status === "done" ? state.result : null;
  const text = state.status === "loading" || state.status === "stopped" ? state.text : (result?.answer ?? "");

  return (
    <section aria-labelledby="ai-summary-title" className="rounded-lg border bg-surface p-4">
      <h2 id="ai-summary-title" className="flex items-center gap-2 text-lg font-semibold">
        <Bot className="size-5 text-primary" aria-hidden />
        {t("title")}
        {state.status === "loading" && (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-foreground">
            {t("generated")}
          </span>
        )}
      </h2>
      <div aria-live="polite" aria-busy={state.status === "loading"} className="mt-2 text-sm">
        {state.status === "loading" && !text && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            {t("busy")}
          </p>
        )}
        {text && <AnswerText text={text} sources={result?.sources ?? []} />}
        {state.status === "done" && !text && <p>{ta("unavailable")}</p>}
        {state.status === "rateLimited" && (
          <p>{state.retryAfter ? ta("rateLimited", { seconds: state.retryAfter }) : ta("rateLimitedNoTime")}</p>
        )}
        {state.status === "error" && <p>{ta("error")}</p>}
        {state.status === "stopped" && <p className="text-muted-foreground">{ta("stopped")}</p>}
      </div>
      {result && (
        <>
          {result.label && <p className="mt-2 text-xs font-medium text-accent">{result.label}</p>}
          <AnswerExtras result={result} />
        </>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{ta("disclaimer")}</p>
    </section>
  );
}
