"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { api, type Schema } from "@/lib/api/client";
import { Dropdown } from "@/components/ui/dropdown";

/** Pick a category that already exists in this resource, or create a new one without retyping the old ones. */
export function CategoryInput({ base, field, resource, value, onChange, disabled }: { base: string; field: string; resource: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const t = useTranslations("admin");
  const faq = useTranslations("info.faq");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-categories", resource, field],
    staleTime: 30_000,
    queryFn: () => api.get<Schema["ListPage"]>(base, { query: { page_size: 100 }, scope: "admin" }),
  });
  // FAQ keeps its category in the row number; every other resource exposes it in `extra`.
  const existing = (data?.items ?? []).map((i) => (resource === "faq" ? i.number : (i.extra as Record<string, unknown> | undefined)?.[field])).filter((x): x is string => typeof x === "string" && x !== "");
  const counts = new Map<string, number>();
  for (const c of existing) counts.set(c, (counts.get(c) ?? 0) + 1);
  if (value && !counts.has(value)) counts.set(value, 0);
  const label = (c: string) => (resource === "faq" && faq.has(`categories.${c}`) ? faq(`categories.${c}`) : c);
  const options = [...counts].map(([v, n]) => ({ value: v, label: label(v), count: n || undefined }));

  if (adding) {
    const add = () => {
      const v = draft.trim();
      if (v) onChange(v);
      setAdding(false);
      setDraft("");
    };
    return (
      <div className="flex gap-2">
        <input autoFocus className="field !rounded-full" value={draft} placeholder={t("category.newName")} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape") setAdding(false); }} />
        <button type="button" onClick={add} className="h-11 shrink-0 rounded-full bg-action px-5 font-semibold text-action-ink">{t("category.add")}</button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <Dropdown label={t("category.pick")} options={options} value={value ? [value] : []} onChange={([v]) => onChange(v)} multiple={false} />
      </div>
      {!disabled && (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-mount-2 px-4 font-semibold text-ink-2 transition-colors hover:text-action">
          <Plus size={16} aria-hidden />{t("category.create")}
        </button>
      )}
    </div>
  );
}
