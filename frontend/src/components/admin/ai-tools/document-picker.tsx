"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pickName } from "@/lib/api/admin";
import { contentApi } from "@/lib/api/admin-content";
import { Notice } from "../notice";
import { useLoad } from "../use-load";

export interface PickedDocument {
  id: string;
  title: string;
  code: string | null;
}

/** Поиск документа каталога по шифру или названию (в пределах прав сотрудника). */
export function DocumentPicker({ onPick }: { onPick: (document: PickedDocument) => void }) {
  const t = useTranslations("adminAi.tools.picker");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useLoad(() => contentApi.list("document", { q: q || undefined, page: 1, page_size: 8 }), [q]);

  return (
    <div className="space-y-3">
      <label className="block space-y-1.5 text-sm font-medium">
        {t("label")}
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("placeholder")} className="font-normal" />
      </label>
      {list.error && <Notice kind="error">{list.error}</Notice>}
      {list.loading && <Notice kind="loading">…</Notice>}
      {list.data && list.data.items.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
      {list.data && list.data.items.length > 0 && (
        <ul aria-label={t("list")} className="divide-y rounded-md border">
          {list.data.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{pickName(item.title, locale) || "—"}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.number ?? ""}</span>
              </span>
              <Button size="sm" variant="outline" onClick={() => onPick({ id: item.id, title: pickName(item.title, locale), code: item.number })}>
                {t("pick")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
