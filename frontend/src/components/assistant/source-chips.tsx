"use client";

import { ArrowUpRight, FileText, Globe, Landmark, MapPin, Newspaper, Frame } from "lucide-react";
import clsx from "clsx";
import { Link } from "@/i18n/navigation";
import type { Schema } from "@/lib/api/client";

const ICONS: Record<string, typeof FileText> = { document: FileText, fund: Landmark, branch: MapPin, news: Newspaper, exhibition: Frame, collection: Frame, page: Globe, section: Globe };

/** Sources as compact chips: a number, a short title, and an arrow that says it opens. */
export function SourceChips({ sources, active }: { sources: Schema["AiSource"][]; active?: string | null }) {
  if (!sources.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {sources.map((s) => {
        const Icon = ICONS[s.type] ?? FileText;
        const inner = (
          <>
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-action text-[0.7rem] font-bold text-action-ink">{s.ref.slice(1)}</span>
            <Icon size={14} className="shrink-0 text-ink-3" aria-hidden />
            <span className="max-w-[15ch] truncate">{s.title}</span>
            <ArrowUpRight size={13} className="shrink-0 text-ink-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-action" aria-hidden />
          </>
        );
        const cls = clsx("group inline-flex h-8 items-center gap-1.5 rounded-full border bg-paper pl-1.5 pr-2.5 text-[0.8125rem] font-medium no-underline transition-[border-color,background-color,transform] duration-200 ease-(--ease-spring) hover:border-action hover:bg-action-soft active:scale-95", active === s.ref ? "border-action bg-action-soft" : "border-frame-strong");
        return (
          <li key={s.ref} id={`src-${s.ref}`} title={s.title + (s.archive_code ? ` · ${s.archive_code}` : "")}>
            {s.href ? <Link href={s.href} className={cls}>{inner}</Link> : s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a> : <span className={cls}>{inner}</span>}
          </li>
        );
      })}
    </ul>
  );
}
