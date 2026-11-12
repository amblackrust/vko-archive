"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUp, Sparkles, Square } from "lucide-react";
import { useAiStream } from "@/lib/ai-stream";
import { AnswerText } from "@/components/search/answer-text";
import { Button } from "@/components/ui/button";

/** Ask a question about one document; answers cite the sheet they come from. */
export function DocAiPanel({ id }: { id: string }) {
  const t = useTranslations("document.ai");
  const locale = useLocale();
  const { state, run, stop } = useAiStream();
  const [q, setQ] = useState("");
  const busy = state.status === "loading" || state.status === "streaming";

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Sparkles size={17} className="text-action" aria-hidden /> {t("title")}</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim() && !busy) void run(`/api/ai/documents/${id}/answer/stream`, { q: q.trim(), lang: locale });
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor={`ai-${id}`} className="sr-only">{t("title")}</label>
        <input id={`ai-${id}`} className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")} maxLength={500} />
        {busy ? (
          <Button variant="secondary" onClick={stop} aria-label={t("send")}><Square size={14} aria-hidden /></Button>
        ) : (
          <Button type="submit" aria-label={t("send")} disabled={!q.trim()}><ArrowUp size={16} aria-hidden /></Button>
        )}
      </form>
      <div aria-live="polite" className="mt-4">
        {state.status === "error" && <p className="text-sm text-ink-3">…</p>}
        {(state.text || busy) && (
          <div className="rounded-2xl bg-table-2 p-4">
            {state.text ? <AnswerText text={state.text} sources={state.result?.sources ?? []} /> : <div className="h-4 w-2/3 animate-pulse rounded bg-table-3" />}
            {state.result?.sources?.some((s) => s.page != null) && (
              <p className="mt-3 flex flex-wrap gap-2 text-xs text-ink-3">
                {state.result.sources.filter((s) => s.page != null).map((s) => <span key={s.ref} className="rounded-full bg-action-soft px-2 py-0.5 text-action">{t("sheet", { n: s.page ?? 0 })}</span>)}
              </p>
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-3">{t("note")}</p>
    </section>
  );
}
