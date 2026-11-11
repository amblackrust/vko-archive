"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pickName } from "@/lib/api/admin";
import { contentApi, type I18nValue, type ListItem } from "@/lib/api/admin-content";
import { useCatalogError } from "../catalog/use-catalog-error";
import { FormField, Select } from "../form-field";
import { Notice } from "../notice";

export type RelatedType = "document" | "exhibition" | "news";
export interface RelatedEntry {
  type: RelatedType;
  id: string;
}

const TYPES: RelatedType[] = ["document", "exhibition", "news"];

interface Props {
  label: string;
  value: RelatedEntry[];
  onChange: (value: RelatedEntry[]) => void;
}

/** Связанные материалы новости: документы, выставки, другие новости. Публично показываются только опубликованные. */
export function RelatedField({ label, value, onChange }: Props) {
  const t = useTranslations("adminContent.related");
  const locale = useLocale();
  const describe = useCatalogError();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  const [type, setType] = useState<RelatedType>("document");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Названия подгружаются по одному; без права просмотра остаётся короткий id.
  useEffect(() => {
    for (const entry of value) {
      const key = `${entry.type}:${entry.id}`;
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      contentApi
        .get(entry.type, entry.id)
        .then((object) => setLabels((current) => ({ ...current, [key]: pickName((object.values.title ?? {}) as I18nValue, locale) })))
        .catch(() => undefined);
    }
  }, [value, locale]);

  async function find() {
    setError(null);
    try {
      setResults((await contentApi.list(type, { q: q.trim() || undefined, page: 1, page_size: 8 })).items);
    } catch (caught) {
      setError(describe(caught));
    }
  }

  function add(row: ListItem) {
    if (value.some((entry) => entry.type === type && entry.id === row.id)) return;
    setLabels((current) => ({ ...current, [`${type}:${row.id}`]: pickName(row.title, locale) }));
    onChange([...value, { type, id: row.id }]);
  }

  return (
    <fieldset className="space-y-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((entry, index) => {
            const name = labels[`${entry.type}:${entry.id}`] || entry.id.slice(0, 8);
            return (
              <li key={`${entry.type}-${entry.id}`} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{t(`types.${entry.type}`)}</span>
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <Button type="button" size="icon" variant="ghost" aria-label={t("remove", { name })} onClick={() => onChange(value.filter((_, i) => i !== index))}>
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <FormField label={t("type")} htmlFor="related-type" className="w-44">
          <Select id="related-type" value={type} onChange={(e) => { setType(e.target.value as RelatedType); setResults(null); }}>
            {TYPES.map((option) => <option key={option} value={option}>{t(`types.${option}`)}</option>)}
          </Select>
        </FormField>
        <div className="flex min-w-48 flex-1 items-end gap-2">
          <Input aria-label={t("search")} placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void find(); } }} />
          <Button type="button" variant="outline" onClick={find}>{t("find")}</Button>
        </div>
      </div>
      {results && (results.length === 0 ? <p className="text-xs text-muted-foreground">{t("nothing")}</p> : (
        <ul className="space-y-1">
          {results.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{pickName(row.title, locale)}{row.number ? <span className="text-muted-foreground"> · {row.number}</span> : null}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => add(row)}><Plus aria-hidden />{t("add")}</Button>
            </li>
          ))}
        </ul>
      ))}
    </fieldset>
  );
}
