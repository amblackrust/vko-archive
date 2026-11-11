"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SourceRow {
  title: string;
  url: string | null;
}

interface SourcesFieldProps {
  label: string;
  value: SourceRow[];
  onChange: (value: SourceRow[]) => void;
}

/** Список источников: название + необязательная http(s)-ссылка. */
export function SourcesField({ label, value, onChange }: SourcesFieldProps) {
  const t = useTranslations("adminContent.sources");
  const set = (index: number, patch: Partial<SourceRow>) => onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {value.map((row, index) => (
        <div key={index} className="flex flex-wrap gap-2">
          <Input className="min-w-40 flex-1" aria-label={t("title", { n: index + 1 })} placeholder={t("titlePlaceholder")} value={row.title} onChange={(e) => set(index, { title: e.target.value })} />
          <Input className="min-w-40 flex-1" type="url" aria-label={t("url", { n: index + 1 })} placeholder="https://" value={row.url ?? ""} onChange={(e) => set(index, { url: e.target.value || null })} />
          <Button type="button" size="icon" variant="ghost" aria-label={t("remove", { n: index + 1 })} onClick={() => onChange(value.filter((_, i) => i !== index))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...value, { title: "", url: null }])}>
        <Plus aria-hidden />
        {t("add")}
      </Button>
    </fieldset>
  );
}
