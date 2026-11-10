import { Fragment } from "react";
import { Link } from "@/lib/i18n/navigation";
import type { AiSource } from "@/lib/api/ai";

const MARKER = /\[(S\d+)\]/g;

/**
 * Текст ответа ИИ — только plain text (никакого HTML). Метки [S1] превращаются в ссылки
 * на карточки из sources; метки без карточки (и пока карточек нет, во время стрима) скрыты.
 */
export function AnswerText({ text, sources }: { text: string; sources: AiSource[] }) {
  const byRef = new Map(sources.map((source) => [source.ref, source]));
  const parts = text.split(MARKER);
  return (
    <p className="whitespace-pre-wrap break-words leading-relaxed">
      {parts.map((part, index) => {
        if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>;
        const source = byRef.get(part);
        if (!source?.href) return null;
        return (
          <Link
            key={index}
            href={source.href}
            aria-label={source.title}
            title={source.title}
            className="mx-0.5 rounded bg-accent-soft px-1 text-xs font-semibold text-accent-soft-foreground hover:underline"
          >
            {part.slice(1)}
          </Link>
        );
      })}
    </p>
  );
}
