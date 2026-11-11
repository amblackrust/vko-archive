import { Fragment } from "react";
import { Link } from "@/lib/i18n/navigation";
import type { AiSource } from "@/lib/api/ai";

const MARKER = /\[(S\d+)\]/g;
const BULLET = /^\s*(?:[-—–•]|\d+[.)])\s+/;

/**
 * Текст ответа помощника — только plain text (никакого HTML). Строки, начатые с «— » или номера, собираются
 * в список; метки [S1] превращаются в номера-ссылки на карточки из sources; метки без карточки
 * (и пока карточек нет, во время стрима) скрыты.
 */
export function AnswerText({ text, sources }: { text: string; sources: AiSource[] }) {
  const byRef = new Map(sources.map((source) => [source.ref, source]));
  const inline = (line: string) =>
    line.split(MARKER).map((part, index) => {
      if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>;
      const source = byRef.get(part);
      if (!source?.href) return null;
      return (
        <Link
          key={index}
          href={source.href}
          aria-label={`${part.slice(1)}: ${source.title}`}
          title={source.title}
          className="mx-0.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-primary-soft px-1 align-[0.08em] text-[0.6875rem] font-bold tabular-nums text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          {part.slice(1)}
        </Link>
      );
    });

  // Блоки: подряд идущие пункты — один список, остальные строки — абзацы.
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const list = BULLET.test(line);
    const last = blocks.at(-1);
    if (list && last?.list) last.lines.push(line.replace(BULLET, ""));
    else blocks.push({ list, lines: [list ? line.replace(BULLET, "") : line] });
  }
  return (
    <div className="space-y-2.5 break-words leading-relaxed">
      {blocks.map((block, index) =>
        block.list ? (
          <ul key={index} className="space-y-1.5">
            {block.lines.map((line, item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span className="min-w-0">{inline(line)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>{inline(block.lines[0])}</p>
        ),
      )}
    </div>
  );
}
