"use client";

import { ArrowUp, Check, Copy, Square } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { AiResult, HistoryTurn } from "@/lib/api/ai";
import { cn } from "@/lib/utils";
import { AnswerText } from "./answer-text";
import { TypingDots } from "./assistant-mark";
import { ASK_EVENT, QUICK_QUESTIONS } from "./quick";
import { AnswerExtras } from "./source-cards";
import { useAnswer, type AnswerState } from "./use-answer";

// v2: формат ленты сменился, старые сохранённые диалоги не подхватываются.
const STORAGE_KEY = "vko-assistant-v2";
const MAX_TURNS = 20;
const HISTORY_TURNS = 6;

interface Turn {
  id: number;
  question: string;
  state: AnswerState;
}

/** Последние реплики для сервера: только текст вопросов и ответов (без источников), урезанный под лимиты API. */
function historyOf(turns: Turn[]): HistoryTurn[] {
  const history: HistoryTurn[] = [];
  for (const turn of turns) {
    history.push({ role: "user", text: turn.question.slice(0, 500) });
    if (turn.state.status === "done" && turn.state.result.ai_generated && turn.state.result.answer) {
      history.push({ role: "assistant", text: turn.state.result.answer.slice(0, 1500) });
    }
  }
  return history.slice(-HISTORY_TURNS);
}

/** Что спросить дальше — по виду найденных источников; вопросы уходят в тот же диалог. */
function followups(result: AiResult): string[] {
  const types = new Set(result.sources.map((source) => source.type));
  if (result.mode === "not_found" || result.mode === "off_topic") return ["howSearch", "branches"];
  if (types.has("branch")) return ["readingRoom", "certificate"];
  if (result.mode === "service") return ["readingRoom", "branches"];
  if (result.sources.length > 0) return ["certificate", "readingRoom"];
  return [];
}

function CopyButton({ text }: { text: string }) {
  const t = useTranslations("ai");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text.replace(/\s*\[S\d+\]/g, ""));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Буфер обмена недоступен (нет разрешения) — кнопка просто не срабатывает.
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span aria-live="polite">{t(copied ? "copied" : "copy")}</span>
    </button>
  );
}

/**
 * Один обмен: вопрос — заголовком, под ним ответ (plain text, номера — ссылки на источники),
 * карточки источников, внешние ссылки и что спросить дальше.
 */
function Exchange({ question, state, onAsk }: { question: string; state: AnswerState; onAsk?: (question: string) => void }) {
  const t = useTranslations("ai");
  const result: AiResult | null = state.status === "done" ? state.result : null;
  const text = state.status === "loading" || state.status === "stopped" ? state.text : (result?.answer ?? "");
  const next = result && onAsk ? followups(result) : [];
  return (
    <article aria-busy={state.status === "loading"} className="border-t pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-lg leading-snug">
        <span className="sr-only">{t("widget.you")}: </span>
        {question}
      </h3>
      <div className="mt-3 text-[0.9375rem]">
        {state.status === "loading" && !text && <TypingDots label={t("widget.thinking")} />}
        {text && <AnswerText text={text} sources={result?.sources ?? []} />}
        {state.status === "stopped" && <p className="mt-1 text-sm text-muted-foreground">{t("stopped")}</p>}
        {state.status === "rateLimited" && <p role="alert">{state.retryAfter ? t("rateLimited", { seconds: state.retryAfter }) : t("rateLimitedNoTime")}</p>}
        {state.status === "error" && <p role="alert">{t("error")}</p>}
      </div>
      {result && (
        <>
          <AnswerExtras result={result} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {result.label && <p className="text-xs text-muted-foreground">{result.label}</p>}
            {result.answer && <CopyButton text={result.answer} />}
          </div>
          {next.length > 0 && (
            <ul aria-label={t("followupsTitle")} className="mt-3 flex flex-wrap gap-2">
              {next.map((id) => (
                <li key={id}>
                  <button type="button" onClick={() => onAsk?.(t(`followups.${id}`))} className="rounded-full bg-primary-soft px-3.5 py-1.5 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
                    {t(`followups.${id}`)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </article>
  );
}

/**
 * Диалог с архивным помощником: лента реплик, вопросы для начала, поле ввода.
 * Общий для плавающей панели и страницы /assistant; завершённые ответы хранятся в sessionStorage,
 * поэтому диалог не теряется при переходе между страницами. Только справочные ответы: заявок через чат нет.
 */
export function Chat({ quick, className, inputId = "assistant-input", autoAsk }: { quick: string[]; className?: string; inputId?: string; /** Вопрос, который задаётся сразу при открытии (кнопка на странице записи). */ autoAsk?: string }) {
  const t = useTranslations("ai");
  const locale = useLocale();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<(question: string) => void>(() => {});
  const { state, ask, cancel } = useAnswer(locale);
  const busy = state.status === "loading";

  useEffect(() => {
    try {
      setTurns(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]"));
    } catch {
      // Повреждённая запись: начинаем пустой диалог.
    }
  }, []);

  // Новый вопрос встаёт к верху ленты: ответ читают с начала, а не с конца.
  useEffect(() => {
    const log = logRef.current;
    const last = log ? [...log.querySelectorAll<HTMLElement>("article")].at(-1) : null;
    if (log && last) log.scrollTop = last.offsetTop - 16;
  }, [turns.length, busy]);

  function save(next: Turn[]) {
    setTurns(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next.filter((turn) => turn.state.status === "done")));
    } catch {
      // Хранилище недоступно: диалог живёт до перезагрузки страницы.
    }
  }

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setInput("");
    setPending(text);
    const final = await ask(text, historyOf(turns));
    save([...turns, { id: Date.now(), question: text, state: final }].slice(-MAX_TURNS));
  }

  // Вопросы-примеры со страницы (AskButton) приходят событием окна.
  useEffect(() => {
    sendRef.current = (question) => void send(question);
  });
  useEffect(() => {
    if (!autoAsk) return;
    // Небольшая пауза: сначала из sessionStorage поднимается прежний диалог, вопрос встаёт после него.
    const timer = setTimeout(() => sendRef.current(autoAsk), 60);
    return () => clearTimeout(timer);
  }, [autoAsk]);
  useEffect(() => {
    const onAsk = (event: Event) => {
      rootRef.current?.scrollIntoView({ block: "nearest" });
      sendRef.current((event as CustomEvent<string>).detail);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);

  return (
    <div ref={rootRef} className={cn("flex min-h-0 flex-col bg-surface", className)}>
      <div ref={logRef} className="relative flex-1 space-y-5 overflow-y-auto px-5 py-5" role="log" aria-live="polite" aria-relevant="additions text">
        {turns.length === 0 && !busy && (
          <section aria-label={t("widget.quickTitle")}>
            <h3 className="text-2xl">{t("widget.hello")}</h3>
            <p className="mt-2 text-[0.9375rem] text-muted-foreground">{t("widget.welcome")}</p>
            <ul className="mt-5 grid auto-rows-fr gap-2.5 sm:grid-cols-2">
              {quick.map((question, index) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => send(question)}
                    className="flex h-full w-full flex-col gap-1 rounded-2xl bg-surface-muted p-4 text-left transition-colors hover:bg-primary-soft"
                  >
                    {QUICK_QUESTIONS[index] && <span className="text-xs font-semibold text-primary">{t(`widget.topics.${QUICK_QUESTIONS[index]}`)}</span>}
                    <span className="text-[0.9375rem] font-medium leading-snug">{question}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {turns.map((turn, index) => (
          <Exchange key={turn.id} question={turn.question} state={turn.state} onAsk={index === turns.length - 1 && !busy ? send : undefined} />
        ))}
        {busy && <Exchange question={pending} state={state} />}
      </div>
      <div className="px-5 pb-4 pt-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
          className="flex items-center gap-2 rounded-2xl border bg-surface p-1.5 pl-4 shadow-card transition-colors focus-within:border-primary"
        >
          <label htmlFor={inputId} className="sr-only">{t("widget.inputLabel")}</label>
          <input
            id={inputId}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t("widget.placeholder")}
            maxLength={500}
            autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent text-base placeholder:text-muted-foreground focus-visible:outline-none"
          />
          {busy ? (
            <button type="button" onClick={cancel} aria-label={t("widget.stop")} className="grid size-10 shrink-0 place-items-center rounded-xl bg-foreground text-background transition-transform active:scale-90">
              <Square className="size-3.5 fill-current" aria-hidden />
            </button>
          ) : (
            <button type="submit" aria-label={t("widget.send")} disabled={!input.trim()} className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-[transform,opacity] active:scale-90 disabled:opacity-35">
              <ArrowUp className="size-5" aria-hidden />
            </button>
          )}
        </form>
        <div className="mt-2 flex items-start justify-between gap-3 px-1 text-xs text-muted-foreground">
          <p>{t("disclaimer")}</p>
          {turns.length > 0 && (
            <button type="button" onClick={() => { cancel(); save([]); }} className="shrink-0 font-medium underline underline-offset-2 hover:text-foreground">
              {t("widget.newDialog")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
