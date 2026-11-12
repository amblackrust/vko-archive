"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles, Square } from "lucide-react";
import { useAiStream } from "@/lib/ai-stream";
import { AnswerText, SourceList } from "./answer-text";
import { Button } from "@/components/ui/button";

/** Streamed AI summary above search results. Quiet when the model is unavailable: search keeps working. */
export function AiSummary({ q }: { q: string }) {
  const t = useTranslations("search.ai");
  const locale = useLocale();
  const { state, run, stop } = useAiStream();

  useEffect(() => {
    if (q.trim().length >= 3) void run("/api/ai/answer/stream", { q, lang: locale });
  }, [q, locale, run]);

  if (state.status === "idle") return null;
  if (state.status === "error") {
    return <p className="mb-6 text-sm text-ink-3">{state.error === "limit" ? t("limit") : t("unavailable")}</p>;
  }
  const result = state.result;
  if (result && !result.ai_available) return <p className="mb-6 text-sm text-ink-3">{t("unavailable")}</p>;

  const loading = state.status === "loading" || (state.status === "streaming" && !state.text);
  return (
    <section aria-live="polite" aria-busy={state.status !== "done"} className="glass mb-8 rounded-3xl border border-line p-6 shadow-lift md:p-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-action"><Sparkles size={16} aria-hidden /> {result?.label || t("label")}</p>
        {(state.status === "streaming" || state.status === "loading") && (
          <Button variant="ghost" size="sm" onClick={stop}><Square size={13} aria-hidden /> {t("stop")}</Button>
        )}
      </div>
      {loading ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-4 w-11/12 animate-pulse rounded bg-table-3" />
          <div className="h-4 w-9/12 animate-pulse rounded bg-table-3" />
        </div>
      ) : (
        <div className="max-w-[75ch] text-lg">
          <AnswerText text={state.text} sources={result?.sources ?? []} />
        </div>
      )}
      {result && <SourceList sources={result.sources ?? []} label={t("sources")} />}
      {result?.links?.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {result.links.map((l) => (
            <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-sm no-underline hover:border-action hover:text-action">{l.id === "egov" ? "eGov.kz" : "e-Otinish"}</a></li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-xs text-ink-3">{t("note")}</p>
    </section>
  );
}
