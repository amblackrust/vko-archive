"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
import clsx from "clsx";

type Group = { category: string; label: string; items: { id: string; question: string; answer: string }[] };

/** Questions grouped by topic; the search narrows them as you type. */
export function FaqList({ groups }: { groups: Group[] }) {
  const t = useTranslations("info.faq");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => groups.map((g) => ({ ...g, items: g.items.filter((i) => !q || `${i.question} ${i.answer}`.toLowerCase().includes(q.toLowerCase())) })).filter((g) => g.items.length), [groups, q]);
  return (
    <div>
      <div className="relative mb-10 max-w-md">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
        <input className="field !rounded-full !pl-11" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} />
      </div>
      {shown.length === 0 && <p className="text-ink-3">{t("empty")}</p>}
      <div className="space-y-12">
        {shown.map((g) => (
          <section key={g.category} className="grid gap-x-12 gap-y-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <h2 className="font-display text-2xl text-ink-3 lg:sticky lg:top-24 lg:self-start">{g.label}</h2>
            <ul className="border-t border-line">
              {g.items.map((i) => {
                const on = open === i.id;
                return (
                  <li key={i.id} className="border-b border-line">
                    <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : i.id)} className="flex w-full items-center justify-between gap-6 py-5 text-left">
                      <span className="font-display text-xl font-medium tracking-[-0.02em] md:text-2xl">{i.question}</span>
                      <Plus size={22} className={clsx("shrink-0 text-ink-3 transition-transform duration-300 ease-(--ease-spring)", on && "rotate-45 text-action")} aria-hidden />
                    </button>
                    <div className={clsx("grid transition-[grid-template-rows] duration-300 ease-(--ease-out)", on ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                      <div className="overflow-hidden"><p className="max-w-[66ch] pb-6 text-lg leading-relaxed text-ink-2">{i.answer}</p></div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
