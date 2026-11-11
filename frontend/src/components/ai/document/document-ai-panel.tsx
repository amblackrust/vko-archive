"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HistoryTurn } from "@/lib/api/ai";
import { aiAvailable, askDocument, RateLimitedError, type DocumentAiResult } from "./api";
import { AnswerText } from "./answer-text";

const QUICK_QUESTIONS = ["when", "who", "what"] as const;
const MAX_QUESTION = 500;
// Пределы history на сервере (docs/AI.md): до 6 реплик, user <= 500, assistant <= 1500, всего <= 4000.
const HISTORY_TURNS = 6;
const HISTORY_ASSISTANT_CHARS = 1500;
const HISTORY_TOTAL_CHARS = 4000;

function trimHistory(turns: HistoryTurn[]): HistoryTurn[] {
  const recent = turns.slice(-HISTORY_TURNS);
  while (recent.length > 2 && recent.reduce((sum, turn) => sum + turn.text.length, 0) > HISTORY_TOTAL_CHARS) recent.splice(0, 2);
  return recent;
}

type Status =
  | { kind: "idle" }
  | { kind: "streaming"; text: string }
  | { kind: "done"; result: DocumentAiResult }
  | { kind: "rateLimited"; retryAfter: number | null }
  | { kind: "error" };

/**
 * «Спросить об этом документе» (T4.6). Сервер отвечает только по открытому тексту
 * этого документа (описание + OCR открытых листов) и указывает лист; без Ollama —
 * сообщение о недоступности. Якорь #ask-document — для ссылки из чата.
 */
export function DocumentAiPanel({ documentId }: { documentId: string }) {
  const t = useTranslations("aiDocument.panel");
  const locale = useLocale();
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [available, setAvailable] = useState<boolean | null>(null);
  const controller = useRef<AbortController | null>(null);
  const history = useRef<HistoryTurn[]>([]);

  useEffect(() => {
    const check = new AbortController();
    aiAvailable(check.signal).then((value) => {
      if (!check.signal.aborted) setAvailable(value);
    });
    return () => {
      check.abort();
      controller.current?.abort();
    };
  }, []);

  async function ask(q: string) {
    const text = q.trim().slice(0, MAX_QUESTION);
    if (!text || status.kind === "streaming") return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setQuestion(text);
    setStatus({ kind: "streaming", text: "" });
    try {
      const result = await askDocument(
        documentId,
        text,
        locale,
        (delta) => setStatus((prev) => (prev.kind === "streaming" ? { kind: "streaming", text: prev.text + delta } : prev)),
        current.signal,
        trimHistory(history.current),
      );
      // В историю попадают только настоящие ответы по документу, не сообщения о сбоях и отказах.
      if (result.mode === "answer") {
        history.current = trimHistory([
          ...history.current,
          { role: "user", text },
          { role: "assistant", text: result.answer.slice(0, HISTORY_ASSISTANT_CHARS) },
        ]);
      }
      setStatus({ kind: "done", result });
      if (result.mode === "unavailable") setAvailable(false);
    } catch (error) {
      if (current.signal.aborted) return;
      if (error instanceof RateLimitedError) setStatus({ kind: "rateLimited", retryAfter: error.retryAfter });
      else {
        console.warn("document AI failed", error);
        setStatus({ kind: "error" });
      }
    }
  }

  const busy = status.kind === "streaming";
  return (
    <section id="ask-document" aria-labelledby="ask-document-title" className="scroll-mt-24 space-y-4 rounded-lg border bg-surface p-5">
      <header className="space-y-1">
        <h2 id="ask-document-title" className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="size-5 text-primary" aria-hidden />
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </header>

      {available === false && status.kind !== "done" && (
        <p role="status" className="rounded-md bg-surface-muted p-3 text-sm">{t("unavailable")}</p>
      )}

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <label htmlFor="ask-document-input" className="sr-only">{t("placeholder")}</label>
        <Input
          id="ask-document-input"
          value={question}
          maxLength={MAX_QUESTION}
          placeholder={t("placeholder")}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={busy || available === false}
        />
        <Button type="submit" disabled={busy || available === false || !question.trim()}>
          {busy ? t("asking") : t("ask")}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("quickTitle")}</span>
        {QUICK_QUESTIONS.map((key) => (
          <Button key={key} type="button" variant="outline" size="sm" disabled={busy || available === false} onClick={() => void ask(t(`quick.${key}`))}>
            {t(`quick.${key}`)}
          </Button>
        ))}
      </div>

      <div aria-live="polite" aria-busy={busy} className="space-y-2">
        {status.kind === "streaming" && (
          <p className="whitespace-pre-line text-muted-foreground">{status.text.replace(/\[S\d{1,3}\]/g, "") || t("asking")}</p>
        )}
        {status.kind === "done" && (
          <>
            <AnswerText text={status.result.answer} sources={status.result.sources} />
            {status.result.links.map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                {t(`links.${link.id}`)}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ))}
            {status.result.label && <p className="text-xs text-muted-foreground">{status.result.label}</p>}
          </>
        )}
        {status.kind === "rateLimited" && (
          <p role="alert" className="text-sm">
            {status.retryAfter ? t("rateLimited", { seconds: status.retryAfter }) : t("rateLimitedNoTime")}
          </p>
        )}
        {status.kind === "error" && <p role="alert" className="text-sm">{t("error")}</p>}
      </div>
    </section>
  );
}
