"use client";

import { AssistantMark } from "./assistant-mark";
import { OPEN_EVENT } from "./quick";

/** Кнопка на странице записи: открывает окно помощника и сразу задаёт вопрос об этой записи. */
export function AskAssistant({ question, children, className }: { question: string; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: question }))} className={className}>
      <AssistantMark className="size-5 shrink-0" />
      {children}
    </button>
  );
}
