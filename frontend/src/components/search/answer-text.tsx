import { Fragment } from "react";
import { Link } from "@/i18n/navigation";
import type { Schema } from "@/lib/api/client";

type Source = Schema["AiSource"];

/** Plain-text answer. `[S1]` markers become small links to the numbered source; nothing is rendered as HTML. */
export function AnswerText({ text, sources }: { text: string; sources: Source[] }) {
  const parts = text.split(/(\[S\d+\])/g);
  return (
    <p className="whitespace-pre-line leading-relaxed">
      {parts.map((part, i) => {
        const m = /^\[(S\d+)\]$/.exec(part);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        const src = sources.find((s) => s.ref === m[1]);
        const n = m[1].slice(1);
        const cls = "mx-0.5 inline-grid size-5 place-items-center rounded-full bg-action-soft align-text-top text-[0.7rem] font-semibold text-action no-underline";
        if (src?.href) return <Link key={i} href={src.href} className={cls} title={src.title}>{n}</Link>;
        if (src?.url) return <a key={i} href={src.url} className={cls} title={src.title} target="_blank" rel="noopener noreferrer">{n}</a>;
        return <span key={i} className={cls}>{n}</span>;
      })}
    </p>
  );
}

export function SourceList({ sources, label }: { sources: Source[]; label: string }) {
  if (!sources.length) return null;
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm text-ink-3">{label}</p>
      <ol className="space-y-1.5 text-sm">
        {sources.map((s) => (
          <li key={s.ref} className="flex items-baseline gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-action-soft text-[0.7rem] font-semibold text-action">{s.ref.slice(1)}</span>
            {s.href ? (
              <Link href={s.href} className="text-ink hover:text-action">{s.title}</Link>
            ) : s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-action">{s.title}</a>
            ) : (
              <span>{s.title}</span>
            )}
            {s.archive_code && <span className="edge">{s.archive_code}</span>}
            {s.page != null && <span className="text-ink-3">· {s.page}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
