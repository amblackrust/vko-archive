"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pickName } from "@/lib/api/admin";
import { contentApi, type ListItem } from "@/lib/api/admin-content";
import { Badge } from "../kit/badge";
import { Select } from "../kit/form";
import { useDebounced, useLoad } from "../kit/hooks";
import { Notice } from "../kit/notice";

interface ObjectSearchProps<K extends string> {
  /** Виды объектов, среди которых ищем; при нескольких появляется список выбора. */
  kinds: readonly K[];
  /** Подпись поля поиска. */
  label: string;
  pickLabel: string;
  onPick: (row: ListItem, kind: K) => void;
  /** Уже выбранное: у таких строк кнопка недоступна. */
  isPicked?: (row: ListItem, kind: K) => boolean;
  /** Показать первые записи до ввода запроса (когда выбор — главное действие экрана). */
  showInitial?: boolean;
}

/**
 * Поиск объекта админки по шифру или названию (в пределах прав сотрудника) и выбор из результатов.
 * Один и тот же блок для связей коллекций, связанных материалов новости, привязки экспоната и ИИ-инструментов.
 */
export function ObjectSearch<K extends string>({ kinds, label, pickLabel, onPick, isPicked, showInitial = false }: ObjectSearchProps<K>) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [kind, setKind] = useState<K>(kinds[0]);
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const list = useLoad(
    () => (showInitial || q ? contentApi.list(kind, { q: q || undefined, page: 1, page_size: 8 }) : Promise.resolve(null)),
    [kind, q],
    "catalog",
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {kinds.length > 1 && (
          <Select className="sm:w-44" aria-label={t("search.type")} value={kind} onChange={(event) => setKind(event.target.value as K)}>
            {kinds.map((option) => <option key={option} value={option}>{t(`objectTypes.${option as string}`)}</option>)}
          </Select>
        )}
        <Input type="search" className="min-w-48 flex-1" aria-label={label} placeholder={label} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && event.preventDefault()} />
      </div>
      {list.error && <Notice kind="error">{list.error}</Notice>}
      <div aria-live="polite" aria-busy={list.loading}>
        {list.data?.items.length === 0 && <p className="text-sm text-muted-foreground">{t("search.nothing")}</p>}
        {list.data && list.data.items.length > 0 && (
          <ul className="divide-y rounded-md border">
            {list.data.items.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block break-words font-medium">{pickName(row.title, locale) || "—"}</span>
                  {row.number && <span className="cipher block text-xs text-muted-foreground">{row.number}</span>}
                </span>
                <Button type="button" size="sm" variant="outline" disabled={isPicked?.(row, kind)} onClick={() => onPick(row, kind)}>
                  <Plus aria-hidden />
                  {pickLabel}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Строка выбранного объекта: вид, название и кнопки справа. */
export function PickedRow({ type, name, children }: { type?: string; name: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {type && <Badge>{type}</Badge>}
      <span className="min-w-0 flex-1 break-words">{name}</span>
      {children}
    </div>
  );
}
