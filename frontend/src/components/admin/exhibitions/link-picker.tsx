"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pickName } from "@/lib/api/admin";
import { contentApi, type ListItem } from "@/lib/api/admin-content";
import { Notice } from "../notice";
import { useCatalogError } from "../catalog/use-catalog-error";

interface LinkPickerProps {
  kind: "document" | "fund";
  /** Текущий id (в форме) — показывается как «выбрано». */
  value: string | null;
  onChange: (id: string | null) => void;
}

/** Привязка экспоната к документу или фонду: поиск по шифру/названию в каталоге (нужно право catalog.view). */
export function LinkPicker({ kind, value, onChange }: LinkPickerProps) {
  const t = useTranslations("adminCatalog.link");
  const locale = useLocale();
  const describe = useCatalogError();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    setError(null);
    try {
      setResults((await contentApi.list(kind, { q: q.trim() || undefined, page: 1, page_size: 8 })).items);
    } catch (caught) {
      setError(describe(caught));
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t(kind)}</legend>
      <p className="text-xs text-muted-foreground">{value ? t("selected", { id: value.slice(0, 8) }) : t("none")}</p>
      <div className="flex gap-2">
        <Input aria-label={t("search")} placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="button" variant="outline" onClick={find}>
          {t("find")}
        </Button>
        {value && (
          <Button type="button" variant="ghost" onClick={() => onChange(null)}>
            {t("clear")}
          </Button>
        )}
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <ul className="space-y-1">
        {results?.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="w-full rounded-md border px-2 py-1 text-left text-sm hover:bg-surface-muted"
              onClick={() => {
                onChange(item.id);
                setResults(null);
              }}
            >
              <span className="font-medium">{item.number}</span> {pickName(item.title, locale)}
            </button>
          </li>
        ))}
      </ul>
      {results?.length === 0 && <p className="text-sm text-muted-foreground">{t("nothing")}</p>}
    </fieldset>
  );
}
