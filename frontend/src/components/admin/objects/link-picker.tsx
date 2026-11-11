"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { pickName } from "@/lib/api/admin";
import { contentApi } from "@/lib/api/admin-content";
import { FieldGroup } from "../kit/form";
import { useLoad } from "../kit/hooks";
import { ObjectSearch } from "./object-search";

interface LinkPickerProps {
  kind: "document" | "fund";
  /** Текущий id в форме. */
  value: string | null;
  onChange: (id: string | null) => void;
}

/** Привязка экспоната к документу или фонду: поиск по шифру или названию в каталоге (нужно право просмотра каталога). */
export function LinkPicker({ kind, value, onChange }: LinkPickerProps) {
  const t = useTranslations("adminCatalog.link");
  const locale = useLocale();
  // Название выбранного объекта; без права просмотра каталога остаётся короткий id.
  const picked = useLoad(() => (value ? contentApi.get(kind, value).catch(() => null) : Promise.resolve(null)), [kind, value], "catalog");
  const name = picked.data
    ? [picked.data.values.archive_code ?? picked.data.values.number, pickName((picked.data.values.title ?? {}) as Record<string, string>, locale)].filter(Boolean).join(" · ")
    : value?.slice(0, 8);
  return (
    <FieldGroup legend={t(kind)}>
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
          <span className="cipher min-w-0 font-medium">{name}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(null)}>{t("clear")}</Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      )}
      <ObjectSearch kinds={[kind]} label={t("search")} pickLabel={t("pick")} isPicked={(row) => row.id === value} onPick={(row) => onChange(row.id)} />
    </FieldGroup>
  );
}
