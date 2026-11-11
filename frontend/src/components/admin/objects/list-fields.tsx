"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pickName } from "@/lib/api/admin";
import { contentApi, filesApi, type I18nValue } from "@/lib/api/admin-content";
import { RowAction } from "../kit/data-table";
import { FieldGroup, Select, SelectField } from "../kit/form";
import { useLoad } from "../kit/hooks";
import { FIELD_LANGS } from "../kit/lang-tabs";
import { localeLabels } from "@/lib/i18n/routing";
import { ObjectSearch, PickedRow } from "./object-search";

const listClass = "divide-y rounded-md border [&>li]:px-3 [&>li]:py-2";

/** Список мест: каждое место — три поля KZ / RU / EN. Варианты других языков сохраняются при правке. */
export function PlacesField({ label, value, onChange }: { label: string; value: I18nValue[]; onChange: (value: I18nValue[]) => void }) {
  const t = useTranslations("adminCatalog.places");
  const setText = (index: number, lang: string, text: string) => onChange(value.map((place, i) => (i === index ? { ...place, [lang]: text } : place)));
  return (
    <FieldGroup legend={label}>
      {value.map((place, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="grid flex-1 gap-2 sm:grid-cols-3">
            {FIELD_LANGS.map((lang) => (
              <Input key={lang} lang={lang} aria-label={t("row", { number: index + 1, lang: localeLabels[lang].short })} placeholder={localeLabels[lang].short} value={place[lang] ?? ""} onChange={(event) => setText(index, lang, event.target.value)} />
            ))}
          </div>
          <RowAction danger label={t("remove", { number: index + 1 })} onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 /></RowAction>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, {}])}>
        <Plus aria-hidden /> {t("add")}
      </Button>
    </FieldGroup>
  );
}

export interface SourceRow {
  title: string;
  url: string | null;
}

/** Список источников: название и необязательная http(s)-ссылка. */
export function SourcesField({ label, value, onChange }: { label: string; value: SourceRow[]; onChange: (value: SourceRow[]) => void }) {
  const t = useTranslations("adminContent.sources");
  const set = (index: number, patch: Partial<SourceRow>) => onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <FieldGroup legend={label}>
      {value.map((row, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <Input aria-label={t("title", { n: index + 1 })} placeholder={t("titlePlaceholder")} value={row.title} onChange={(event) => set(index, { title: event.target.value })} />
            <Input type="url" aria-label={t("url", { n: index + 1 })} placeholder="https://" value={row.url ?? ""} onChange={(event) => set(index, { url: event.target.value || null })} />
          </div>
          <RowAction danger label={t("remove", { n: index + 1 })} onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 /></RowAction>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...value, { title: "", url: null }])}>
        <Plus aria-hidden /> {t("add")}
      </Button>
    </FieldGroup>
  );
}

export interface MediaEntry {
  file_id?: string | null;
  url?: string | null;
}

/** Галерея новости: файлы, загруженные к ней, и внешние https-ссылки. Обложка выбирается отдельно, в блоке файлов. */
export function MediaField({ label, value, onChange, ownerId }: { label: string; value: MediaEntry[]; onChange: (value: MediaEntry[]) => void; ownerId?: string }) {
  const t = useTranslations("adminContent.media");
  const [url, setUrl] = useState("");
  const [fileId, setFileId] = useState("");
  const files = useLoad(() => (ownerId ? filesApi.list("news", ownerId) : Promise.resolve([])), [ownerId], "catalog");
  const uploaded = files.data ?? [];
  const nameOf = (id: string) => uploaded.find((file) => file.id === id)?.original_name ?? id.slice(0, 8);
  const validUrl = /^https:\/\//i.test(url.trim());

  function addUrl() {
    if (!validUrl) return;
    onChange([...value, { url: url.trim() }]);
    setUrl("");
  }

  return (
    <FieldGroup legend={label} hint={value.length === 0 ? t("empty") : undefined}>
      {value.length > 0 && (
        <ul className={listClass}>
          {value.map((entry, index) => {
            const name = entry.file_id ? nameOf(entry.file_id) : (entry.url ?? "");
            return (
              <li key={`${entry.file_id ?? entry.url}-${index}`}>
                <PickedRow type={entry.file_id ? t("file") : t("link")} name={name}>
                  <RowAction label={t("remove", { name })} onClick={() => onChange(value.filter((_, i) => i !== index))}><X /></RowAction>
                </PickedRow>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Input type="url" className="min-w-48 flex-1" aria-label={t("url")} placeholder="https://" value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addUrl(); } }} />
        <Button type="button" variant="outline" onClick={addUrl} disabled={!validUrl}><Plus aria-hidden />{t("addLink")}</Button>
      </div>
      {ownerId ? (
        <div className="flex flex-wrap gap-2">
          <Select className="min-w-48 flex-1" aria-label={t("pickFile")} onFocus={files.reload} value={fileId} onChange={(event) => setFileId(event.target.value)}>
            <option value="">{t("pickFile")}</option>
            {uploaded.filter((file) => !value.some((entry) => entry.file_id === file.id)).map((file) => (
              <option key={file.id} value={file.id}>{file.original_name ?? file.id.slice(0, 8)}</option>
            ))}
          </Select>
          <Button type="button" variant="outline" disabled={!fileId} onClick={() => { onChange([...value, { file_id: fileId }]); setFileId(""); }}>
            <Plus aria-hidden />{t("addFile")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("filesAfterSave")}</p>
      )}
    </FieldGroup>
  );
}

const RELATED_TYPES = ["document", "exhibition", "news"] as const;
export interface RelatedEntry {
  type: (typeof RELATED_TYPES)[number];
  id: string;
}

/** Связанные материалы новости: документы, выставки, другие новости. Посетителю показываются только опубликованные. */
export function RelatedField({ label, value, onChange }: { label: string; value: RelatedEntry[]; onChange: (value: RelatedEntry[]) => void }) {
  const t = useTranslations("adminContent.related");
  const types = useTranslations("admin.objectTypes");
  const locale = useLocale();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());

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

  return (
    <FieldGroup legend={label} hint={value.length === 0 ? t("empty") : undefined}>
      {value.length > 0 && (
        <ul className={listClass}>
          {value.map((entry, index) => {
            const name = labels[`${entry.type}:${entry.id}`] || entry.id.slice(0, 8);
            return (
              <li key={`${entry.type}-${entry.id}`}>
                <PickedRow type={types(entry.type)} name={name}>
                  <RowAction label={t("remove", { name })} onClick={() => onChange(value.filter((_, i) => i !== index))}><X /></RowAction>
                </PickedRow>
              </li>
            );
          })}
        </ul>
      )}
      <ObjectSearch
        kinds={RELATED_TYPES}
        label={t("search")}
        pickLabel={t("add")}
        isPicked={(row, type) => value.some((entry) => entry.type === type && entry.id === row.id)}
        onPick={(row, type) => {
          requested.current.add(`${type}:${row.id}`);
          setLabels((current) => ({ ...current, [`${type}:${row.id}`]: pickName(row.title, locale) }));
          onChange([...value, { type, id: row.id }]);
        }}
      />
    </FieldGroup>
  );
}

/** Выбор одной записи из справочника: нормативный акт (основание цены) или филиал фонда. */
export function ReferenceField({ label, hint, value, onChange, load }: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  load: () => Promise<{ id: string; label: string }[]>;
}) {
  const options = useLoad(load, [], "catalog");
  const items = options.data ?? [];
  return (
    <SelectField label={label} hint={options.error ?? hint} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">—</option>
      {value && !items.some((item) => item.id === value) && <option value={value}>{value.slice(0, 8)}</option>}
      {items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </SelectField>
  );
}
