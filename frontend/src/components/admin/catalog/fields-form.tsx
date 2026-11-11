"use client";

import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { pickName } from "@/lib/api/admin";
import type { I18nValue, Values } from "@/lib/api/admin-content";
import { FormField, Select } from "../form-field";
import { RichTextField } from "../cms/rich-text-field";
import { LegalActField } from "../cms/legal-act-field";
import { MediaField, type MediaEntry } from "../cms/media-field";
import { RelatedField, type RelatedEntry } from "../cms/related-field";
import { SourcesField } from "../cms/sources-field";
import { PlacesField } from "./places-field";
import { I18nField, type MachineTranslateProps } from "../i18n-field";

export type FieldSpec =
  | { name: string; type: "text" | "date" | "slug"; required?: boolean; maxLength?: number; lockedOnEdit?: boolean }
  | { name: string; type: "number"; required?: boolean; step?: string }
  | { name: string; type: "i18n" | "i18nArea"; required?: boolean }
  | { name: string; type: "select"; options: string[]; required?: boolean }
  | { name: string; type: "bool" }
  | { name: string; type: "branch" }
  | { name: string; type: "lines" }
  | { name: string; type: "rich"; required?: boolean }
  | { name: string; type: "sources" }
  | { name: string; type: "media" }
  | { name: string; type: "related" }
  | { name: string; type: "legalAct" };

export interface BranchChoice {
  id: string;
  name: I18nValue;
}

interface FieldsFormProps {
  idPrefix: string;
  spec: FieldSpec[];
  values: Values;
  onChange: (name: string, value: Values[string]) => void;
  branches?: BranchChoice[];
  translationStatus?: Record<string, string>;
  /** Объект уже создан: поля lockedOnEdit недоступны. */
  editing: boolean;
  /** Namespace подписей полей (fields.<name>, options.<name>.<value>); по умолчанию каталог. */
  ns?: string;
  /** Кнопка чернового перевода ИИ под i18n-полями (только для сохранённого черновика). */
  machine?: MachineTranslateProps;
  /** Id сохранённого объекта: нужен полям, выбирающим его загруженные файлы. */
  ownerId?: string;
}

/** Форма по описанию полей: подписи — adminCatalog.fields.<name>, варианты списков — adminCatalog.options.<name>.<value>. */
export function FieldsForm({ idPrefix, spec, values, onChange, branches = [], translationStatus, editing, ns = "adminCatalog", machine, ownerId }: FieldsFormProps) {
  const t = useTranslations("adminCatalog");
  const tf = useTranslations(ns);
  const locale = useLocale();
  return (
    <div className="space-y-4">
      {spec.map((field) => {
        const id = `${idPrefix}-${field.name}`;
        const label = tf(`fields.${field.name}`);
        const value = values[field.name];
        switch (field.type) {
          case "i18n":
          case "i18nArea":
            return (
              <I18nField
                key={field.name}
                label={label}
                required={field.required}
                multiline={field.type === "i18nArea"}
                value={(value as I18nValue) ?? {}}
                translationStatus={translationStatus}
                machine={machine}
                onChange={(next) => onChange(field.name, next)}
              />
            );
          case "rich":
            return (
              <RichTextField
                key={field.name}
                label={label}
                value={(value as I18nValue) ?? {}}
                translationStatus={translationStatus}
                machine={machine}
                onChange={(next) => onChange(field.name, next)}
              />
            );
          case "sources":
            return (
              <SourcesField
                key={field.name}
                label={label}
                value={(value as unknown as { title: string; url: string | null }[]) ?? []}
                onChange={(next) => onChange(field.name, next as unknown as Values[string])}
              />
            );
          case "media":
            return (
              <MediaField
                key={field.name}
                label={label}
                ownerId={ownerId}
                value={(value as unknown as MediaEntry[]) ?? []}
                onChange={(next) => onChange(field.name, next as unknown as Values[string])}
              />
            );
          case "related":
            return (
              <RelatedField
                key={field.name}
                label={label}
                value={(value as unknown as RelatedEntry[]) ?? []}
                onChange={(next) => onChange(field.name, next as unknown as Values[string])}
              />
            );
          case "legalAct":
            return <LegalActField key={field.name} id={id} label={label} value={(value as string | null) ?? null} onChange={(next) => onChange(field.name, next)} />;
          case "select":
            return (
              <FormField key={field.name} label={label} htmlFor={id}>
                <Select id={id} required={field.required} value={String(value ?? "")} onChange={(e) => onChange(field.name, e.target.value)}>
                  {!field.required && <option value="">—</option>}
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {tf(`options.${field.name}.${option}`)}
                    </option>
                  ))}
                </Select>
              </FormField>
            );
          case "branch":
            return (
              <FormField key={field.name} label={label} htmlFor={id} hint={t("hints.branch")}>
                <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(field.name, e.target.value || null)}>
                  <option value="">—</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {pickName(branch.name, locale)}
                    </option>
                  ))}
                </Select>
              </FormField>
            );
          case "bool":
            return (
              <label key={field.name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" checked={Boolean(value)} onChange={(e) => onChange(field.name, e.target.checked)} />
                {label}
              </label>
            );
          case "lines":
            return (
              <PlacesField
                key={field.name}
                label={label}
                value={((value as I18nValue[]) ?? []).filter((place) => place && typeof place === "object")}
                onChange={(next) => onChange(field.name, next)}
              />
            );
          case "number":
            return (
              <FormField key={field.name} label={label} htmlFor={id}>
                <Input
                  id={id}
                  type="number"
                  step={field.step}
                  required={field.required}
                  value={value === null || value === undefined ? "" : String(value)}
                  onChange={(e) => onChange(field.name, e.target.value === "" ? null : Number(e.target.value))}
                />
              </FormField>
            );
          default:
            return (
              <FormField key={field.name} label={label} htmlFor={id} hint={field.type === "slug" ? t("hints.slug") : undefined}>
                <Input
                  id={id}
                  type={field.type === "date" ? "date" : "text"}
                  required={field.required}
                  maxLength={field.maxLength}
                  disabled={field.lockedOnEdit && editing}
                  value={field.type === "date" ? String(value ?? "").slice(0, 10) : String(value ?? "")}
                  onChange={(e) => onChange(field.name, e.target.value === "" && !field.required ? null : e.target.value)}
                />
              </FormField>
            );
        }
      })}
    </div>
  );
}
