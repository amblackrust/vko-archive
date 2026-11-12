"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import { ArrowUpRight, Image as ImageIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AccessBadge } from "@/components/ui/badge";
import { DocPreview } from "./doc-preview";

export type ResultItem = {
  id: string;
  type: string;
  title: string;
  href: string;
  snippet?: string;
  doc?: { code: string; date: string; docType: string; access: string; digital: boolean; demo: boolean; place?: string };
};

/** List on the left, live preview on the right. On phones it is a plain list. */
export function ResultsInspector({ groups }: { groups: { type: string; label: string; total: number; items: ResultItem[]; more?: React.ReactNode }[] }) {
  const d = useTranslations("dict");
  const all = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const [selected, setSelected] = useState<string | null>(all.find((i) => i.type === "document")?.id ?? null);
  const current = all.find((i) => i.id === selected);

  return (
    <div className="grid items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <div className="space-y-12">
        {groups.map((g) => (
          <section key={g.type}>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-2xl md:text-3xl">{g.label} <span className="tnum text-lg text-ink-3">{g.total}</span></h2>
              {g.more}
            </div>
            <ul>
              {g.items.map((it) => (
                <li key={it.id} className="border-b border-line first:border-t">
                  <Link
                    href={it.href}
                    onMouseEnter={() => setSelected(it.id)}
                    onFocus={() => setSelected(it.id)}
                    aria-current={selected === it.id ? "true" : undefined}
                    className={clsx("group -mx-4 grid grid-cols-[1fr_auto] items-start gap-x-5 gap-y-1 rounded-2xl px-4 py-4 no-underline transition-colors md:grid-cols-[10rem_1fr_auto]", selected === it.id ? "bg-action-soft" : "hover:bg-table-2")}
                  >
                    <span className="edge col-span-2 md:col-span-1 md:pt-1.5">{it.doc?.code ?? ""}</span>
                    <span className="min-w-0">
                      <span className="block font-display text-xl font-medium tracking-[-0.02em]">{it.title}</span>
                      {it.doc ? (
                        <span className="mt-1 block text-sm text-ink-3">{[d.has(`docType.${it.doc.docType}`) ? d(`docType.${it.doc.docType}`) : it.doc.docType, it.doc.date, it.doc.place].filter(Boolean).join(" · ")}</span>
                      ) : (
                        it.snippet && <span className="mt-1 block max-w-[70ch] text-sm text-ink-3" dangerouslySetInnerHTML={{ __html: it.snippet }} />
                      )}
                    </span>
                    {it.doc && (
                      <span className="flex items-center gap-2 self-center">
                        {it.doc.digital && <ImageIcon size={16} className="text-ink-3" aria-hidden />}
                        
                        <AccessBadge access={it.doc.access} />
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <aside aria-label="preview" className="hidden lg:sticky lg:top-20 lg:block">
        {current?.type === "document" ? (
          <DocPreview id={current.id} />
        ) : current ? (
          <div>
            <h2 className="text-3xl md:text-4xl">{current.title}</h2>
            {current.snippet && <p className="mt-4 text-ink-2" dangerouslySetInnerHTML={{ __html: current.snippet }} />}
            <Link href={current.href} className="mt-6 inline-flex items-center gap-1 text-action">{current.href} <ArrowUpRight size={16} aria-hidden /></Link>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
