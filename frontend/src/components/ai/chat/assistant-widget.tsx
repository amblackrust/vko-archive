"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bot, Send, Square, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiResult } from "@/lib/api/ai";
import { AnswerText } from "./answer-text";
import { AnswerExtras } from "./source-cards";
import { useAnswer, type AnswerState } from "./use-answer";

const QUICK = ["certificate", "ridder", "photos", "hours"] as const;
const MAX_MESSAGES = 20;

interface Turn {
  id: number;
  question: string;
  state: AnswerState;
}

function Notice({ state }: { state: AnswerState }) {
  const t = useTranslations("ai");
  if (state.status === "rateLimited") {
    return <p role="alert">{state.retryAfter ? t("rateLimited", { seconds: state.retryAfter }) : t("rateLimitedNoTime")}</p>;
  }
  if (state.status === "error") return <p role="alert">{t("error")}</p>;
  return null;
}

/** Ответ помощника: текст — plain text, [Sn] — ссылки на карточки, под ним карточки и внешние ссылки. */
function AssistantBubble({ state }: { state: AnswerState }) {
  const t = useTranslations("ai");
  const result: AiResult | null = state.status === "done" ? state.result : null;
  const text =
    state.status === "loading" || state.status === "stopped" ? state.text : result ? result.answer : "";
  const sources = result?.sources ?? [];
  return (
    <div className="rounded-lg rounded-tl-none border bg-surface-muted p-3 text-sm">
      {state.status === "loading" && !text && <p className="text-muted-foreground">{t("widget.thinking")}</p>}
      {text && <AnswerText text={text} sources={sources} />}
      {state.status === "stopped" && <p className="mt-1 text-muted-foreground">{t("stopped")}</p>}
      <Notice state={state} />
      {result && (
        <>
          {result.label && <p className="mt-2 text-xs font-medium text-accent">{result.label}</p>}
          <AnswerExtras result={result} />
        </>
      )}
    </div>
  );
}

/**
 * Плавающий «Архивный помощник» на всех страницах. Модальный диалог (Radix): фокус заперт внутри,
 * Esc закрывает, фокус возвращается на кнопку. На мобильном — на весь экран. Только справочные ответы:
 * заявок и запросов через чат нет.
 */
export function AssistantWidget() {
  const t = useTranslations("ai");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const { state, ask, cancel } = useAnswer(locale);
  const busy = state.status === "loading";

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setInput("");
    const id = nextId.current++;
    const final = await ask(text);
    setTurns((prev) => [...prev, { id, question: text, state: final }].slice(-MAX_MESSAGES));
    endRef.current?.scrollIntoView({ block: "end" });
  }

  function clear() {
    cancel();
    setTurns([]);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          size="lg"
          className="fixed bottom-4 right-4 z-40 rounded-full shadow-lg print:hidden"
          aria-label={t("widget.open")}
        >
          <Bot aria-hidden />
          <span className="hidden sm:inline">{t("widget.open")}</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:bg-transparent" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById("assistant-input")?.focus();
          }}
          className="fixed inset-0 z-50 flex flex-col bg-background sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(40rem,calc(100dvh-2rem))] sm:w-[26rem] sm:rounded-lg sm:border sm:shadow-2xl"
        >
          <header className="flex items-start gap-2 border-b p-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="flex items-center gap-2 font-semibold">
                <Bot className="size-5 text-primary" aria-hidden />
                {t("widget.title")}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                {t("widget.description")}
              </Dialog.Description>
            </div>
            {turns.length > 0 && (
              <Button variant="ghost" size="icon" onClick={clear} aria-label={t("widget.newDialog")} title={t("widget.newDialog")}>
                <Trash2 />
              </Button>
            )}
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={t("widget.close")}>
                <X />
              </Button>
            </Dialog.Close>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto p-3" role="log" aria-live="polite" aria-relevant="additions text">
            <div className="rounded-lg rounded-tl-none border bg-surface-muted p-3 text-sm">{t("widget.welcome")}</div>
            {turns.map((turn) => (
              <div key={turn.id} className="space-y-2">
                <p className="ml-auto w-fit max-w-[85%] break-words rounded-lg rounded-tr-none bg-primary px-3 py-2 text-sm text-primary-foreground">
                  <span className="sr-only">{t("widget.you")}: </span>
                  {turn.question}
                </p>
                <AssistantBubble state={turn.state} />
              </div>
            ))}
            {busy && (
              <div className="space-y-2" aria-busy="true">
                <AssistantBubble state={state} />
              </div>
            )}
            {turns.length === 0 && !busy && (
              <section aria-label={t("widget.quickTitle")}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("widget.quickTitle")}</h3>
                <ul className="flex flex-wrap gap-2">
                  {QUICK.map((key) => (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => send(t(`widget.quick.${key}`))}
                        className="rounded-full border bg-surface px-3 py-1.5 text-left text-sm hover:bg-surface-muted"
                      >
                        {t(`widget.quick.${key}`)}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div ref={endRef} />
          </div>

          <footer className="border-t p-3">
            <p className="mb-2 text-xs text-muted-foreground">{t("disclaimer")}</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
              className="flex gap-2"
            >
              <label htmlFor="assistant-input" className="sr-only">{t("widget.inputLabel")}</label>
              <Input
                id="assistant-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={t("widget.placeholder")}
                maxLength={500}
                autoComplete="off"
              />
              {busy ? (
                <Button type="button" variant="outline" size="icon" onClick={cancel} aria-label={t("widget.stop")}>
                  <Square />
                </Button>
              ) : (
                <Button type="submit" size="icon" aria-label={t("widget.send")} disabled={!input.trim()}>
                  <Send />
                </Button>
              )}
            </form>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
