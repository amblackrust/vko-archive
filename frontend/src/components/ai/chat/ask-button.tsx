"use client";

import { ArrowUpRight } from "lucide-react";
import { ASK_EVENT } from "./quick";

/** Пример вопроса вне диалога: по нажатию вопрос уходит в открытый на странице чат. */
export function AskButton({ label, question, hint }: { label: string; question: string; hint: string }) {
  return (
    <button
      type="button"
      title={hint}
      onClick={() => window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: question }))}
      className="group flex w-full items-start justify-between gap-3 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className="mt-0.5 block font-medium group-hover:text-primary">«{question}»</span>
      </span>
      <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
    </button>
  );
}
