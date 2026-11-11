"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { TypingDots } from "@/components/ai/chat/assistant-mark";
import { ExternalLink } from "@/components/ui/external-link";
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
  | { kind: "streaming"; text: string }
  | { kind: "done"; result: DocumentAiResult }
  | { kind: "rateLimited"; retryAfter: number | null }
  | { kind: "error" };

interface Turn {
  id: number;
  question: string;
  status: Status;
}

/**
 * «Спросить об этом документе» (T4.6) — в том же виде, что и диалог помощника: вопрос заголовком, под ним ответ,
 * в тексте — метки листов, откуда взят фрагмент, и пометка об автоматическом тексте. Сервер отвечает только
 * по открытому тексту этого документа (описание + OCR открытых листов); без Ollama вопросы отключены.
 * Якорь #ask-document — для ссылки из чата.
 */
export function DocumentAiPanel({ documentId }: { documentId: string }) {
  const t = useTranslations("aiDocument.panel");
  const locale = useLocale();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
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

  const busy = turns.at(-1)?.status.kind === "streaming";

  async function ask(q: string) {
    const text = q.trim().slice(0, MAX_QUESTION);
    if (!text || busy) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const id = Date.now();
    const update = (next: (status: Status) => Status) => setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, status: next(turn.status) } : turn)));
    setQuestion("");
    setTurns((all) => [...all, { id, question: text, status: { kind: "streaming", text: "" } }]);
    try {
      const result = await askDocument(
        documentId,
        text,
        locale,
        (delta) => update((status) => (status.kind === "streaming" ? { kind: "streaming", text: status.text + delta } : status)),
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
      update(() => ({ kind: "done", result }));
      if (result.mode === "unavailable") setAvailable(false);
    } catch (error) {
      if (current.signal.aborted) return;
      if (error instanceof RateLimitedError) update(() => ({ kind: "rateLimited", retryAfter: (error as RateLimitedError).retryAfter }));
      else {
        console.warn("document AI failed", error);
        update(() => ({ kind: "error" }));
      }
    }
  }

  const off = busy || available === false;
  const asked = new Set(turns.map((turn) => turn.question));
  const quick = QUICK_QUESTIONS.map((key) => t(`quick.${key}`)).filter((text) => !asked.has(text));
  return (
    <section id="ask-document" aria-labelledby="ask-document-title" className="card scroll-mt-24 p-5 sm:p-6">
      <h2 id="ask-document-title" className="text-xl sm:text-2xl">{t("title")}</h2>
      <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>

      {available === false && turns.length === 0 && <p role="status" className="mt-4 text-[0.9375rem]">{t("unavailable")}</p>}

      {turns.length > 0 && (
        <div role="log" aria-live="polite" className="mt-5 space-y-5 border-t pt-5">
          {turns.map(({ id, question: title, status }) => (
            <article key={id} aria-busy={status.kind === "streaming"} className="border-t pt-5 first:border-t-0 first:pt-0">
              <h3 className="text-lg leading-snug">{title}</h3>
              <div className="mt-2.5 text-[0.9375rem]">
                {status.kind === "streaming" &&
                  (status.text ? <p className="whitespace-pre-line leading-relaxed">{status.text.replace(/\[S\d{1,3}\]/g, "")}</p> : <TypingDots label={t("asking")} />)}
                {status.kind === "done" && (
                  <>
                    <AnswerText text={status.result.answer} sources={status.result.sources} />
                    {status.result.links.length > 0 && (
                      <p className="mt-3 flex flex-wrap gap-2 text-sm">
                        {status.result.links.map((link) => (
                          <ExternalLink key={link.id} href={link.url} className="rounded-full bg-primary-soft px-3.5 py-1.5 font-semibold text-primary">{t(`links.${link.id}`)}</ExternalLink>
                        ))}
                      </p>
                    )}
                    {status.result.label && <p className="mt-3 text-xs text-muted-foreground">{status.result.label}</p>}
                  </>
                )}
                {status.kind === "rateLimited" && <p role="alert">{status.retryAfter ? t("rateLimited", { seconds: status.retryAfter }) : t("rateLimitedNoTime")}</p>}
                {status.kind === "error" && <p role="alert">{t("error")}</p>}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Готовые вопросы: до первого вопроса — равные плитки, дальше — короткая строка под ответом. */}
      {quick.length > 0 && (
        <ul aria-label={t("quickTitle")} className={turns.length === 0 ? "mt-5 grid auto-rows-fr gap-2.5 sm:grid-cols-3" : "mt-4 flex flex-wrap gap-2"}>
          {quick.map((text) => (
            <li key={text}>
              <button
                type="button"
                disabled={off}
                onClick={() => void ask(text)}
                className={
                  turns.length === 0
                    ? "h-full w-full rounded-2xl bg-surface-muted p-4 text-left text-[0.9375rem] font-medium leading-snug transition-colors hover:bg-primary-soft hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                    : "rounded-full bg-primary-soft px-3.5 py-1.5 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
                }
              >
                {text}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 flex items-center gap-2 rounded-2xl border bg-surface p-1.5 pl-4 shadow-card transition-colors focus-within:border-primary"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <label htmlFor="ask-document-input" className="sr-only">{t("inputLabel")}</label>
        <input
          id="ask-document-input"
          value={question}
          maxLength={MAX_QUESTION}
          placeholder={t("placeholder")}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={off}
          autoComplete="off"
          className="h-10 min-w-0 flex-1 bg-transparent text-base placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
        />
        <button type="submit" aria-label={t("ask")} disabled={off || !question.trim()} className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-[transform,opacity] active:scale-90 disabled:opacity-35">
          <ArrowUp className="size-5" aria-hidden />
        </button>
      </form>
    </section>
  );
}
