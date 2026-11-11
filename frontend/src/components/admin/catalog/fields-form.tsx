"use client";

import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { pickName } from "@/lib/api/admin";
import type { I18nValue, Values } from "@/lib/api/admin-content";
import { FormField, Select } from "../form-field";
import { I18nField } from "../i18n-field";

export type FieldSpec =
  | { name: string; type: "text" | "date" | "slug"; required?: boolean; maxLength?: number; lockedOnEdit?: boolean }
  | { name: string; type: "number"; required?: boolean }
  | { name: string; type: "i18n" | "i18nArea"; required?: boolean }
  | { name: string; type: "select"; options: string[]; required?: boolean }
  | { name: string; type: "bool" }
  | { name: string; type: "branch" }
  | { name: string; type: "lines" };

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
}

/** Форма по описанию полей: подписи — adminCatalog.fields.<name>, варианты списков — adminCatalog.options.<name>.<value>. */
export function FieldsForm({ idPrefix, spec, values, onChange, branches = [], translationStatus, editing }: FieldsFormProps) {
  const t = useTranslations("adminCatalog");
  const locale = useLocale();
  return (
    <div className="space-y-4">
      {spec.map((field) => {
        const id = `${idPrefix}-${field.name}`;
        const label = t(`fields.${field.name}`);
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
                onChange={(next) => onChange(field.name, next)}
              />
            );
          case "select":
            return (
              <FormField key={field.name} label={label} htmlFor={id}>
                <Select id={id} required={field.required} value={String(value ?? "")} onChange={(e) => onChange(field.name, e.target.value)}>
                  {!field.required && <option value="">—</option>}
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {t(`options.${field.name}.${option}`)}
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
              <FormField key={field.name} label={label} htmlFor={id} hint={t("hints.lines")}>
                <textarea
                  id={id}
                  rows={3}
                  className="w-full rounded-md border bg-surface px-3 py-2 text-sm"
                  value={((value as I18nValue[]) ?? []).map((place) => place.ru ?? Object.values(place)[0] ?? "").join("\n")}
                  onChange={(e) =>
                    onChange(
                      field.name,
                      e.target.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line) => ({ ru: line })),
                    )
                  }
                />
              </FormField>
            );
          case "number":
            return (
              <FormField key={field.name} label={label} htmlFor={id}>
                <Input
                  id={id}
                  type="number"
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
                  value={String(value ?? "")}
                  onChange={(e) => onChange(field.name, e.target.value === "" && !field.required ? null : e.target.value)}
                />
              </FormField>
            );
        }
      })}
    </div>
  );
}
