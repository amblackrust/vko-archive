"use client";

import { useLocale, useTranslations } from "next-intl";
import { pickName } from "@/lib/api/admin";
import { contentApi, type I18nValue, type Values } from "@/lib/api/admin-content";
import { Checkbox, SelectField, TextField } from "../kit/form";
import { I18nField, type MachineTranslateProps } from "./i18n-field";
import { MediaField, PlacesField, ReferenceField, RelatedField, SourcesField, type MediaEntry, type RelatedEntry, type SourceRow } from "./list-fields";
import { RichTextField } from "./rich-text-field";
import type { FieldSpec } from "./specs";

interface FieldsFormProps {
  spec: FieldSpec[];
  values: Values;
  onChange: (name: string, value: Values[string]) => void;
  translationStatus?: Record<string, string>;
  /** Объект уже создан: поля lockedOnEdit недоступны. */
  editing: boolean;
  /** Namespace подписей: fields.<name>, options.<name>.<value>, sections.<name>. */
  ns: "adminCatalog" | "adminContent";
  /** Кнопка чернового перевода ИИ под многоязычными полями (только для сохранённого черновика). */
  machine?: MachineTranslateProps;
  /** Id сохранённого объекта: нужен полям, выбирающим его загруженные файлы. */
  ownerId?: string;
}

const wide = "sm:col-span-2";

/**
 * Форма по описанию полей. Короткие поля встают в две колонки, многоязычные и списки — на всю ширину;
 * на телефоне всё в одну колонку.
 */
export function FieldsForm({ spec, values, onChange, translationStatus, editing, ns, machine, ownerId }: FieldsFormProps) {
  const t = useTranslations(ns);
  const hints = useTranslations("adminCatalog.hints");
  const locale = useLocale();
  return (
    <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
      {spec.map((field) => {
        const value = values[field.name];
        const label = field.type === "section" ? "" : t(`fields.${field.name}`);
        const set = (next: unknown) => onChange(field.name, next as Values[string]);
        switch (field.type) {
          case "section":
            return <h3 key={`section-${field.name}`} className={`${wide} border-t pt-5 text-base font-bold`}>{t(`sections.${field.name}`)}</h3>;
          case "i18n":
          case "i18nArea":
            return (
              <div key={field.name} className={wide}>
                <I18nField label={label} required={field.required} multiline={field.type === "i18nArea"} value={(value as I18nValue) ?? {}} translationStatus={translationStatus} machine={machine} onChange={set} />
              </div>
            );
          case "rich":
            return (
              <div key={field.name} className={wide}>
                <RichTextField label={label} value={(value as I18nValue) ?? {}} translationStatus={translationStatus} machine={machine} onChange={set} />
              </div>
            );
          case "sources":
            return <div key={field.name} className={wide}><SourcesField label={label} value={(value as unknown as SourceRow[]) ?? []} onChange={set} /></div>;
          case "media":
            return <div key={field.name} className={wide}><MediaField label={label} ownerId={ownerId} value={(value as unknown as MediaEntry[]) ?? []} onChange={set} /></div>;
          case "related":
            return <div key={field.name} className={wide}><RelatedField label={label} value={(value as unknown as RelatedEntry[]) ?? []} onChange={set} /></div>;
          case "lines":
            return (
              <div key={field.name} className={wide}>
                <PlacesField label={label} value={((value as I18nValue[]) ?? []).filter((place) => place && typeof place === "object")} onChange={set} />
              </div>
            );
          case "legalAct":
            return (
              <ReferenceField
                key={field.name}
                label={label}
                value={(value as string | null) ?? null}
                onChange={set}
                load={async () =>
                  (await contentApi.list("legal_act", { page: 1, page_size: 100 })).items.map((item) => ({
                    id: item.id,
                    label: [item.number, pickName(item.title, locale)].filter(Boolean).join(" · "),
                  }))
                }
              />
            );
          case "branch":
            return (
              <ReferenceField
                key={field.name}
                label={label}
                hint={hints("branch")}
                value={(value as string | null) ?? null}
                onChange={set}
                load={async () => (await contentApi.branchOptions()).map((branch) => ({ id: branch.id, label: pickName(branch.name, locale) }))}
              />
            );
          case "select":
            return (
              <SelectField key={field.name} label={label} required={field.required} value={String(value ?? "")} onChange={(event) => set(event.target.value)}>
                {!field.required && <option value="">—</option>}
                {field.options.map((option) => <option key={option} value={option}>{t(`options.${field.name}.${option}`)}</option>)}
              </SelectField>
            );
          case "bool":
            return <Checkbox key={field.name} className={wide} label={label} checked={Boolean(value)} onChange={(event) => set(event.target.checked)} />;
          case "number":
            return (
              <TextField
                key={field.name}
                label={label}
                type="number"
                step={field.step}
                required={field.required}
                value={value === null || value === undefined ? "" : String(value)}
                onChange={(event) => set(event.target.value === "" ? null : Number(event.target.value))}
              />
            );
          default:
            return (
              <TextField
                key={field.name}
                label={label}
                hint={field.type === "slug" ? hints("slug") : undefined}
                type={field.type === "date" ? "date" : "text"}
                required={field.required}
                maxLength={field.maxLength}
                disabled={field.lockedOnEdit && editing}
                value={field.type === "date" ? String(value ?? "").slice(0, 10) : String(value ?? "")}
                onChange={(event) => set(event.target.value === "" && !field.required ? null : event.target.value)}
              />
            );
        }
      })}
    </div>
  );
}
