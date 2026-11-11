"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { I18nValue } from "@/lib/api/admin-content";
import { FIELD_LANGS } from "../i18n-field";

interface PlacesFieldProps {
  label: string;
  value: I18nValue[];
  onChange: (value: I18nValue[]) => void;
}

/** Список мест: каждое место — три поля kk/ru/en. Варианты других языков сохраняются при правке. */
export function PlacesField({ label, value, onChange }: PlacesFieldProps) {
  const t = useTranslations("adminCatalog.places");
  const setText = (index: number, lang: string, text: string) =>
    onChange(value.map((place, i) => (i === index ? { ...place, [lang]: text } : place)));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {value.map((place, index) => (
        <div key={index} className="flex items-start gap-2 rounded-md border p-2">
          <div className="grid flex-1 gap-2 sm:grid-cols-3">
            {FIELD_LANGS.map((lang) => (
              <Input
                key={lang}
                lang={lang}
                aria-label={t("row", { number: index + 1, lang: lang.toUpperCase() })}
                placeholder={lang.toUpperCase()}
                value={place[lang] ?? ""}
                onChange={(e) => setText(index, lang, e.target.value)}
              />
            ))}
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={t("remove", { number: index + 1 })} onClick={() => onChange(value.filter((_, i) => i !== index))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, {}])}>
        <Plus aria-hidden /> {t("add")}
      </Button>
    </fieldset>
  );
}
